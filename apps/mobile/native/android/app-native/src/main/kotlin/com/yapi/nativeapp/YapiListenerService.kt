package com.yapi.nativeapp

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

/**
 * Captura las notificaciones de las apps elegidas y las reenvía al worker
 * (/ingest), que las enruta a los canales del usuario. Refresca el ID token
 * de Firebase cuando hace falta (el idToken dura 1h; usamos el refresh token).
 */
class YapiListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        if (pkg == packageName) return
        val extras = sbn.notification?.extras
        val title = extras?.getString(Notification.EXTRA_TITLE)?.trim().orEmpty()
        val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        // En hilo aparte: red + posible refresco de token.
        Thread { handle(pkg, title, text) }.start()
    }

    private fun handle(pkg: String, title: String, text: String) {
        val data = ListenerPrefs.read(this) ?: return
        Log.i(TAG, "notif de $pkg | permitidas=${data.packages}")
        if (!data.packages.contains(pkg)) return
        if (title.isEmpty() && text.isEmpty()) return

        val token = freshToken(data) ?: run { Log.w(TAG, "sin token; no se reenvía $pkg"); return }
        val body = JSONObject()
            .put("deviceId", data.deviceId)
            .put("package", pkg)
            .put("title", if (title.isEmpty()) pkg else title)
            .put("text", text)
            .toString()
        val req = Request.Builder()
            .url(Config.WORKER_URL + "/ingest")
            .addHeader("Authorization", "Bearer $token")
            .post(body.toRequestBody(JSON))
            .build()
        Log.i(TAG, "reenviando $pkg -> /ingest")
        try {
            Net.client.newCall(req).execute().use { res ->
                val responseText = res.body?.string().orEmpty()
                Log.i(TAG, "ingest resp ${res.code} para $pkg")
                if (res.isSuccessful) postClientRequests(responseText)
            }
        } catch (e: Exception) {
            Log.w(TAG, "ingest POST falló", e)
        }
    }

    private fun postClientRequests(responseText: String) {
        if (responseText.isBlank()) return
        val requests = runCatching {
            JSONObject(responseText).optJSONArray("clientRequests")
        }.getOrNull() ?: return

        for (i in 0 until requests.length()) {
            val request = requests.optJSONObject(i) ?: continue
            postClientRequest(request)
        }
    }

    private fun postClientRequest(request: JSONObject) {
        val id = request.optString("id", "")
        val url = request.optString("url", "")
        if (!url.startsWith("http://") && !url.startsWith("https://")) return

        val body = jsonString(request.opt("body"))
        val builder = Request.Builder().url(url)
        val headers = request.optJSONObject("headers")
        if (headers != null) {
            val keys = headers.keys()
            while (keys.hasNext()) {
                val name = keys.next()
                if (name.equals("Content-Type", ignoreCase = true)) continue
                if (name.equals("Content-Length", ignoreCase = true)) continue
                if (name.equals("Host", ignoreCase = true)) continue
                if (name.equals("X-Yapi-Payload-Bytes", ignoreCase = true)) continue
                val value = headers.optString(name, "")
                if (value.isNotBlank()) builder.addHeader(name, value)
            }
        }
        val outbound = builder
            .addHeader("X-Yapi-Payload-Bytes", body.toByteArray(Charsets.UTF_8).size.toString())
            .post(body.toRequestBody(JSON))
            .build()
        try {
            Net.client.newCall(outbound).execute().use { res ->
                Log.i(TAG, "webhook cliente resp ${res.code} para ${id.ifBlank { url }}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "webhook cliente falló para ${id.ifBlank { url }}", e)
        }
    }

    private fun jsonString(value: Any?): String =
        when (value) {
            null, JSONObject.NULL -> "{}"
            is JSONObject -> value.toString()
            is JSONArray -> value.toString()
            else -> JSONObject().put("value", value).toString()
        }

    /** Devuelve un idToken válido; refresca con el refresh token si está por vencer. */
    private fun freshToken(data: ListenerPrefs.Data): String? {
        if (data.expiresAt - System.currentTimeMillis() > 5 * 60_000) return data.idToken
        return try {
            val form = FormBody.Builder()
                .add("grant_type", "refresh_token")
                .add("refresh_token", data.refreshToken)
                .build()
            val req = Request.Builder()
                .url("https://securetoken.googleapis.com/v1/token?key=${Config.FIREBASE_API_KEY}")
                .post(form)
                .build()
            Net.client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return null
                val obj = JSONObject(res.body!!.string())
                val idToken = obj.getString("id_token")
                val refresh = obj.getString("refresh_token")
                val exp = System.currentTimeMillis() + obj.getString("expires_in").toLong() * 1000
                ListenerPrefs.updateToken(this, idToken, refresh, exp)
                idToken
            }
        } catch (e: Exception) {
            Log.w(TAG, "refresh de token falló", e)
            null
        }
    }

    companion object {
        private const val TAG = "YapiNativeIngest"
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

package com.yapi.ingest

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

/**
 * Lee las notificaciones del sistema y reenvía al worker (POST /ingest) solo las
 * de las apps que el usuario permitió (guardadas en `Prefs`). El worker decide a
 * qué canales van (dispositivo∈canal ∧ app∈canal ∧ horario).
 *
 * Requiere el permiso especial "Acceso a notificaciones", que el usuario concede
 * en Ajustes (lo abre `IngestModule.openNotificationAccessSettings`). El servicio
 * corre en segundo plano aunque la LynxView esté cerrada.
 */
class YapiNotificationListenerService : NotificationListenerService() {

    private val http = OkHttpClient()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        try {
            handle(sbn)
        } catch (e: Exception) {
            Log.w(TAG, "ingest error", e)
        }
    }

    private fun handle(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        if (pkg == packageName) return // ignora las propias

        val allowed = Prefs.allowedPackages(this)
        Log.i(TAG, "notif de $pkg | permitidas=$allowed")
        if (!allowed.contains(pkg)) return // solo apps permitidas

        val token = Prefs.read(this, Prefs.TOKEN)
        val workerUrl = Prefs.read(this, Prefs.WORKER_URL)
        val deviceId = Prefs.read(this, Prefs.DEVICE_ID)
        if (token == null || workerUrl == null || deviceId == null) {
            Log.w(TAG, "sin sesión (token/url/deviceId) — no se reenvía $pkg")
            return
        }

        val extras = sbn.notification?.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE)?.trim().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        if (title.isEmpty() && text.isEmpty()) return

        val body = JSONObject()
            .put("deviceId", deviceId)
            .put("package", pkg)
            .put("title", if (title.isEmpty()) pkg else title)
            .put("text", text)
            .toString()

        val request = Request.Builder()
            .url("$workerUrl/ingest")
            .addHeader("Authorization", "Bearer $token")
            .post(body.toRequestBody(JSON))
            .build()

        Log.i(TAG, "reenviando $pkg -> $workerUrl/ingest")
        http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "ingest POST falló", e)
            }

            override fun onResponse(call: Call, response: Response) {
                Log.i(TAG, "ingest resp ${response.code} para $pkg")
                response.close()
            }
        })
    }

    companion object {
        private const val TAG = "YapiIngest"
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

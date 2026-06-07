package com.yapi.nativeapp

import android.content.Context

/**
 * Sesión que el servicio lector necesita para reenviar (token, deviceId, apps
 * permitidas). En SharedPreferences porque el servicio corre fuera de Compose.
 */
object ListenerPrefs {
    private const val P = "yapi_listener"
    private const val ID_TOKEN = "idToken"
    private const val REFRESH = "refreshToken"
    private const val EXPIRES = "expiresAt"
    private const val DEVICE_ID = "deviceId"
    private const val PACKAGES = "packages"

    private fun prefs(context: Context) =
        context.getSharedPreferences(P, Context.MODE_PRIVATE)

    data class Data(
        val idToken: String,
        val refreshToken: String,
        val expiresAt: Long,
        val deviceId: String,
        val packages: Set<String>,
    )

    fun save(
        context: Context,
        idToken: String,
        refreshToken: String,
        expiresAt: Long,
        deviceId: String,
        packages: Set<String>,
    ) {
        prefs(context).edit()
            .putString(ID_TOKEN, idToken)
            .putString(REFRESH, refreshToken)
            .putLong(EXPIRES, expiresAt)
            .putString(DEVICE_ID, deviceId)
            .putStringSet(PACKAGES, packages)
            .apply()
    }

    /** Actualiza solo el token (tras refrescar dentro del servicio). */
    fun updateToken(context: Context, idToken: String, refreshToken: String, expiresAt: Long) {
        prefs(context).edit()
            .putString(ID_TOKEN, idToken)
            .putString(REFRESH, refreshToken)
            .putLong(EXPIRES, expiresAt)
            .apply()
    }

    fun read(context: Context): Data? {
        val p = prefs(context)
        val id = p.getString(ID_TOKEN, null) ?: return null
        val refresh = p.getString(REFRESH, null) ?: return null
        val deviceId = p.getString(DEVICE_ID, null) ?: return null
        return Data(
            id,
            refresh,
            p.getLong(EXPIRES, 0),
            deviceId,
            p.getStringSet(PACKAGES, emptySet()) ?: emptySet(),
        )
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }
}

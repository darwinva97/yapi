package com.yapi.ingest

import android.content.Context

/**
 * Almacén compartido entre el módulo Lynx (que escribe la sesión cuando la app
 * está abierta) y el NotificationListenerService (que la lee en segundo plano,
 * aunque la LynxView esté cerrada).
 */
internal object Prefs {
    private const val FILE = "yapi_ingest"
    const val TOKEN = "token"
    const val WORKER_URL = "workerUrl"
    const val DEVICE_ID = "deviceId"
    /** Packages permitidos, separados por coma (las apps elegidas del dispositivo). */
    const val PACKAGES = "packages"

    fun read(context: Context, key: String): String? =
        context
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(key, null)

    fun write(context: Context, values: Map<String, String>) {
        val editor = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
        for ((k, v) in values) editor.putString(k, v)
        editor.apply()
    }

    fun allowedPackages(context: Context): Set<String> {
        val csv = read(context, PACKAGES) ?: return emptySet()
        return csv.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }
}

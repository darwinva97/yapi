package com.yapi.ingest

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

/**
 * NativeModule de Lynx que conecta la app ReactLynx con el lector nativo.
 *
 * Lado JS (apps/mobile/src/notifListener.ts):
 *   NativeModules.IngestModule.setSession(token, workerUrl, deviceId, packagesCsv)
 *   NativeModules.IngestModule.openNotificationAccessSettings()
 *   NativeModules.IngestModule.hasNotificationAccess() → "1" | "0"
 *
 * `setSession` persiste lo necesario para que el
 * `YapiNotificationListenerService` pueda subir notificaciones aunque la app
 * esté cerrada.
 */
class IngestModule(context: Context) : LynxModule(context) {

    private val appContext: Context = context.applicationContext

    @LynxMethod
    fun setSession(token: String, workerUrl: String, deviceId: String, packagesCsv: String) {
        Prefs.write(
            appContext,
            mapOf(
                Prefs.TOKEN to token,
                Prefs.WORKER_URL to workerUrl.trimEnd('/'),
                Prefs.DEVICE_ID to deviceId,
                Prefs.PACKAGES to packagesCsv,
            ),
        )
    }

    /** Abre la pantalla de Ajustes para conceder "Acceso a notificaciones". */
    @LynxMethod
    fun openNotificationAccessSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(intent)
    }

    /** "1" si el usuario ya concedió el acceso a notificaciones, "0" si no. */
    @LynxMethod
    fun hasNotificationAccess(): String {
        val enabled = Settings.Secure.getString(
            appContext.contentResolver,
            "enabled_notification_listeners",
        )
        val granted = enabled?.contains(appContext.packageName) == true
        return if (granted) "1" else "0"
    }
}

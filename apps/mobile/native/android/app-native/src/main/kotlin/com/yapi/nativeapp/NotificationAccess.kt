package com.yapi.nativeapp

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings

/** Estado y acceso al permiso "Acceso a notificaciones" para el lector. */
object NotificationAccess {
    fun isGranted(context: Context): Boolean {
        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners",
        ) ?: return false
        val me = ComponentName(context, YapiListenerService::class.java)
        return flat.split(":").any {
            val c = ComponentName.unflattenFromString(it)
            c != null && c.packageName == context.packageName &&
                c.className == me.className
        }
    }

    fun openSettings(context: Context) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}

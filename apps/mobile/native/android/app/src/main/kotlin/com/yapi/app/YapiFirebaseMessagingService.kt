package com.yapi.app

import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Recibe y muestra las push notifications en el host app de Lynx.
 *
 * - App en background + payload `notification`: Android la muestra en la bandeja
 *   automáticamente (este servicio no se invoca).
 * - App en foreground, o mensajes `data`: se construye y muestra aquí.
 *
 * Registrar en AndroidManifest.xml (ver README).
 */
class YapiFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // El token rotó: reenvíalo al backend (POST /api/devices) si ya hay sesión.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val notification = message.notification ?: return
        val channelId = "yapi_default"

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(channelId, "yapi", NotificationManager.IMPORTANCE_HIGH),
        )

        val notif = NotificationCompat.Builder(this, channelId)
            .setContentTitle(notification.title ?: "yapi")
            .setContentText(notification.body ?: "")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .build()

        manager.notify((System.currentTimeMillis() % 100000).toInt(), notif)
    }
}

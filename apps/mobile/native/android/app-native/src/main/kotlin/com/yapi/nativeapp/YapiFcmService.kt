package com.yapi.nativeapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Recibe el push (FCM) reenviado por el worker y lo muestra como notificación. */
class YapiFcmService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification
        val title = n?.title ?: message.data["title"] ?: "yapi"
        val body = n?.body ?: message.data["body"] ?: ""
        Notifications.show(this, title, body)
    }

    override fun onNewToken(token: String) {
        // Re-registrar el dispositivo con el token nuevo (best-effort).
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { Devices.ensureRegistered(applicationContext) }
        }
    }
}

object Notifications {
    const val CHANNEL_ID = "yapi_forward"
    private var nextId = 1000

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Reenvíos de yapi", NotificationManager.IMPORTANCE_HIGH,
            )
            val mgr = context.getSystemService(NotificationManager::class.java)
            mgr.createNotificationChannel(channel)
        }
    }

    fun show(context: Context, title: String, body: String) {
        ensureChannel(context)
        val notif = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(nextId++, notif) }
    }
}

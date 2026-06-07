package com.yapi.nativeapp

import android.content.Context

/**
 * Registro del dispositivo de este teléfono y sincronización de la sesión del
 * lector (token + deviceId + apps permitidas) que usa YapiListenerService.
 */
object Devices {
    private const val DEVICE_NAME = "Mi teléfono"
    // Debe estar en el enum Platform del contrato (ios|android|web|lynx|unknown).
    private const val PLATFORM = "android"

    /** Registra (idempotente: el worker deduplica por nombre+plataforma) y sincroniza el lector. */
    suspend fun ensureRegistered(context: Context): Device {
        val device = Api.registerDevice(
            context,
            Api.RegisterDeviceReq(name = DEVICE_NAME, platform = PLATFORM),
        )
        syncListener(context, device)
        return device
    }

    /** Escribe en ListenerPrefs lo que el servicio necesita para reenviar. */
    fun syncListener(context: Context, device: Device) {
        val s = Session.current() ?: return
        ListenerPrefs.save(
            context,
            s.idToken,
            s.refreshToken,
            s.expiresAt,
            device.id,
            device.apps.map { it.pkg }.toSet(),
        )
    }
}

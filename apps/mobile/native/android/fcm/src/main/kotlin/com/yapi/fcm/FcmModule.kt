package com.yapi.fcm

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/**
 * NativeModule de Lynx que expone el token de Firebase Cloud Messaging a ReactLynx.
 *
 * Lado JS (apps/mobile/src/fcm.ts):
 *   NativeModules.FcmModule.getToken((token) => { ... })
 *
 * Registro en el host app (YapiApp.onCreate):
 *   LynxEnv.inst().registerModule("FcmModule", FcmModule::class.java)
 */
class FcmModule(context: Context) : LynxModule(context) {

    /** Devuelve el registration token de FCM por callback ("" si falla). */
    @LynxMethod
    fun getToken(callback: Callback) {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                callback.invoke(if (task.isSuccessful) task.result else "")
            }
    }
}

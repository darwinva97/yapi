package com.yapi.ingest

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback

/**
 * Almacenamiento clave-valor persistente para la app ReactLynx (SharedPreferences).
 * Lo usa la sesión para sobrevivir reinicios (guardar el refresh token de Firebase).
 *
 * Lado JS (apps/mobile/src/storage.ts):
 *   NativeModules.StorageModule.setItem(key, value)
 *   NativeModules.StorageModule.getItem(key, (value) => { ... })   // "" si no existe
 *   NativeModules.StorageModule.removeItem(key)
 */
class StorageModule(context: Context) : LynxModule(context) {

    private val prefs =
        context.applicationContext.getSharedPreferences("yapi_kv", Context.MODE_PRIVATE)

    @LynxMethod
    fun setItem(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    /** Entrega el valor por callback ("" si no existe). */
    @LynxMethod
    fun getItem(key: String, callback: Callback) {
        callback.invoke(prefs.getString(key, "") ?: "")
    }

    @LynxMethod
    fun removeItem(key: String) {
        prefs.edit().remove(key).apply()
    }
}

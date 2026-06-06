package com.yapi.auth

import android.app.Activity
import android.content.Intent
import com.facebook.CallbackManager

/**
 * Puente entre el `MainActivity` del host app y el `SocialAuthModule` de Lynx.
 *
 * Los SDK de Google/Facebook necesitan una `Activity` viva para abrir la
 * pantalla de consentimiento, pero un `LynxModule` solo recibe un `Context`. El
 * host registra aquí su Activity actual (en `onCreate`/`onResume`) y reenvía el
 * `onActivityResult` al `callbackManager` para que Facebook complete su flujo.
 */
object CurrentActivity {
    /** Activity en primer plano, o null si no hay ninguna. */
    @JvmStatic
    var activity: Activity? = null

    /** CallbackManager compartido para el resultado del login de Facebook. */
    @JvmStatic
    val callbackManager: CallbackManager = CallbackManager.Factory.create()

    /**
     * Reenvía el resultado de Activity al SDK de Facebook. El host (MainActivity)
     * llama aquí desde `onActivityResult` para no depender de los tipos de
     * Facebook en su propio classpath.
     */
    @JvmStatic
    fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        return callbackManager.onActivityResult(requestCode, resultCode, data)
    }
}

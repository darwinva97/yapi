package com.yapi.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * NativeModule de Lynx que expone el login social (Google / Facebook) a ReactLynx.
 *
 * Lado JS (apps/mobile/src/socialAuth.ts):
 *   NativeModules.SocialAuthModule.signInGoogle((credential) => { ... })
 *   NativeModules.SocialAuthModule.signInFacebook((credential) => { ... })
 *
 * La credencial que devuelve (ID token de Google / access token de Facebook) se
 * envía al worker (`POST /auth/google` · `/auth/facebook`), que la valida contra
 * los servidores del proveedor. Cada callback devuelve "" si el usuario cancela
 * o hay error.
 *
 * Registro en el host app (YapiApp.onCreate):
 *   LynxEnv.inst().registerModule("SocialAuthModule", SocialAuthModule::class.java)
 *
 * Configuración (res/values/strings.xml):
 *   - google_server_client_id → el **web client id** de OAuth (mismo valor que
 *     `GOOGLE_CLIENT_ID` del worker, para que el `aud` del ID token cuadre).
 *   - facebook_app_id / facebook_client_token → tu app de Facebook.
 */
class SocialAuthModule(context: Context) : LynxModule(context) {

    @LynxMethod
    fun signInGoogle(callback: Callback) {
        val activity = CurrentActivity.activity
        if (activity == null) {
            callback.invoke("")
            return
        }

        val serverClientId = stringRes(activity, "google_server_client_id")
        if (serverClientId.isNullOrBlank()) {
            callback.invoke("")
            return
        }

        val option = GetGoogleIdOption.Builder()
            .setServerClientId(serverClientId)
            // false → permite elegir cualquier cuenta, no solo las ya autorizadas.
            .setFilterByAuthorizedAccounts(false)
            .build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val credentialManager = CredentialManager.create(activity)

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val result = credentialManager.getCredential(activity, request)
                val cred = result.credential
                val token =
                    if (cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                        GoogleIdTokenCredential.createFrom(cred.data).idToken
                    } else {
                        ""
                    }
                callback.invoke(token)
            } catch (e: GetCredentialException) {
                callback.invoke("")
            } catch (e: Exception) {
                callback.invoke("")
            }
        }
    }

    @LynxMethod
    fun signInFacebook(callback: Callback) {
        val activity = CurrentActivity.activity
        if (activity == null) {
            callback.invoke("")
            return
        }

        val manager = LoginManager.getInstance()
        manager.registerCallback(
            CurrentActivity.callbackManager,
            object : FacebookCallback<LoginResult> {
                override fun onSuccess(result: LoginResult) {
                    callback.invoke(result.accessToken.token)
                    manager.unregisterCallback(CurrentActivity.callbackManager)
                }

                override fun onCancel() {
                    callback.invoke("")
                    manager.unregisterCallback(CurrentActivity.callbackManager)
                }

                override fun onError(error: FacebookException) {
                    callback.invoke("")
                    manager.unregisterCallback(CurrentActivity.callbackManager)
                }
            },
        )
        manager.logInWithReadPermissions(activity, listOf("email", "public_profile"))
    }

    /** Lee un string resource por nombre sin depender de la clase `R` del host. */
    private fun stringRes(context: Context, name: String): String? {
        val id = context.resources.getIdentifier(name, "string", context.packageName)
        return if (id != 0) context.getString(id) else null
    }
}

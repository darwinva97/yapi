package com.yapi.nativeapp

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Inicio de sesión con Google usando Credential Manager. Obtiene el ID token de
 * Google y lo intercambia por una sesión de Firebase (mismo flujo que el correo).
 *
 * Usamos GetSignInWithGoogleOption (el flujo del BOTÓN explícito "Iniciar sesión
 * con Google"): siempre abre el selector de cuentas y hace re-autenticación
 * interactiva. Evita los fallos del one-tap (GetGoogleIdOption): "No credentials
 * available" y "[16] Account reauth failed".
 */
object GoogleAuth {
    // Web client ID del proyecto (de google-services.json, client_type 3).
    private const val WEB_CLIENT_ID =
        "174017374070-gj8dk7k7g49opnmeihdevp015ra3ksiu.apps.googleusercontent.com"

    suspend fun signIn(activityContext: Context): User {
        val manager = CredentialManager.create(activityContext)
        val option = GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()

        val result = manager.getCredential(activityContext, request)
        val cred = result.credential
        if (cred !is CustomCredential ||
            cred.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            throw ApiException("No se obtuvo la cuenta de Google", 401)
        }
        val googleIdToken = GoogleIdTokenCredential.createFrom(cred.data).idToken

        val fb = FirebaseAuth.signInWithGoogle(googleIdToken)
        val user = Api.meWithToken(fb.idToken)
        Session.save(activityContext, StoredSession(fb.idToken, fb.refreshToken, fb.expiresAt, user))
        return user
    }
}

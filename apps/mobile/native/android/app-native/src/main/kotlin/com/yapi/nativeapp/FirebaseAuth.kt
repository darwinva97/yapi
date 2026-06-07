package com.yapi.nativeapp

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.FormBody
import okhttp3.Request

/** Inicio de sesión con Firebase Authentication vía REST (Identity Toolkit). */
object FirebaseAuth {
    private const val IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts"
    private const val SECURETOKEN = "https://securetoken.googleapis.com/v1/token"
    // encodeDefaults: para que `returnSecureToken = true` (default) SÍ se envíe.
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    data class FbSession(val idToken: String, val refreshToken: String, val expiresAt: Long)

    @Serializable
    private data class IdentityResp(
        val idToken: String? = null,
        val refreshToken: String? = null,
        val expiresIn: String? = null,
        val error: ErrorObj? = null,
    )

    @Serializable
    private data class ErrorObj(val message: String? = null)

    @Serializable
    private data class IdentityReq(
        val email: String,
        val password: String,
        val returnSecureToken: Boolean = true,
    )

    @Serializable
    private data class TokenResp(
        val id_token: String? = null,
        val refresh_token: String? = null,
        val expires_in: String? = null,
    )

    private fun describe(code: String?): String = when (code) {
        "EMAIL_EXISTS" -> "Ese correo ya está registrado"
        "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS" ->
            "Correo o contraseña incorrectos"
        "INVALID_EMAIL" -> "Correo inválido"
        "OPERATION_NOT_ALLOWED" -> "Método no habilitado"
        else -> code ?: "No se pudo iniciar sesión"
    }

    private suspend fun identity(action: String, email: String, password: String): FbSession {
        val body = jsonBody(
            json.encodeToString(IdentityReq.serializer(), IdentityReq(email, password)),
        )
        val req = Request.Builder()
            .url("$IDENTITY:$action?key=${Config.FIREBASE_API_KEY}")
            .post(body)
            .build()
        val text = Net.call(req)
        val r = json.decodeFromString<IdentityResp>(text)
        if (r.idToken == null || r.refreshToken == null) {
            throw ApiException(describe(r.error?.message), 401)
        }
        return FbSession(
            r.idToken,
            r.refreshToken,
            System.currentTimeMillis() + (r.expiresIn?.toLongOrNull() ?: 3600) * 1000,
        )
    }

    suspend fun signUp(email: String, password: String) = identity("signUp", email, password)
    suspend fun signIn(email: String, password: String) =
        identity("signInWithPassword", email, password)

    suspend fun refresh(refreshToken: String): FbSession {
        val form = FormBody.Builder()
            .add("grant_type", "refresh_token")
            .add("refresh_token", refreshToken)
            .build()
        val req = Request.Builder()
            .url("$SECURETOKEN?key=${Config.FIREBASE_API_KEY}")
            .post(form)
            .build()
        val text = Net.call(req)
        val r = json.decodeFromString<TokenResp>(text)
        if (r.id_token == null || r.refresh_token == null) throw ApiException("Sesión expirada", 401)
        return FbSession(
            r.id_token,
            r.refresh_token,
            System.currentTimeMillis() + (r.expires_in?.toLongOrNull() ?: 3600) * 1000,
        )
    }
}

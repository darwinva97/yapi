package com.yapi.nativeapp

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private val Context.dataStore by preferencesDataStore(name = "yapi_session")

@Serializable
data class StoredSession(
    val idToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val user: User,
)

/**
 * Sesión del usuario, persistida con DataStore para sobrevivir reinicios. El
 * `idToken` de Firebase se refresca con el `refreshToken` (de larga duración).
 */
object Session {
    private val KEY = stringPreferencesKey("session")
    private val json = Json { ignoreUnknownKeys = true }

    @Volatile
    private var cache: StoredSession? = null

    suspend fun load(context: Context): StoredSession? {
        val raw = context.dataStore.data.first()[KEY] ?: return null
        return runCatching { json.decodeFromString<StoredSession>(raw) }
            .getOrNull()
            ?.also { cache = it }
    }

    suspend fun save(context: Context, session: StoredSession) {
        cache = session
        context.dataStore.edit { it[KEY] = json.encodeToString(StoredSession.serializer(), session) }
    }

    suspend fun clear(context: Context) {
        cache = null
        context.dataStore.edit { it.remove(KEY) }
    }

    fun currentUser(): User? = cache?.user

    /** ID token válido (refresca si vence en <5 min). Null si no hay sesión. */
    suspend fun freshIdToken(context: Context): String? {
        val s = cache ?: load(context) ?: return null
        if (s.expiresAt - System.currentTimeMillis() > 5 * 60_000) return s.idToken
        val refreshed = runCatching { FirebaseAuth.refresh(s.refreshToken) }.getOrNull()
            ?: run { clear(context); return null }
        val updated = s.copy(
            idToken = refreshed.idToken,
            refreshToken = refreshed.refreshToken,
            expiresAt = refreshed.expiresAt,
        )
        save(context, updated)
        return updated.idToken
    }
}

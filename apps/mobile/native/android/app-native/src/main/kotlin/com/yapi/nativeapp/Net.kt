package com.yapi.nativeapp

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/** Cliente HTTP + JSON compartidos. */
object Net {
    val client = OkHttpClient()
    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        // No serializar campos null: el worker valida opcionales con .optional()
        // (acepta ausencia, NO null) → un `apps: null` daría "Datos inválidos".
        explicitNulls = false
    }

    /** Ejecuta una request en IO y devuelve el cuerpo como texto (lanza en no-2xx). */
    suspend fun call(request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { res ->
            val body = res.body?.string().orEmpty()
            if (!res.isSuccessful) {
                val msg = runCatching {
                    json.parseToJsonElement(body)
                }.getOrNull()?.let { el ->
                    runCatching {
                        (el as? kotlinx.serialization.json.JsonObject)
                            ?.get("error")?.toString()?.trim('"')
                    }.getOrNull()
                }
                throw ApiException(msg ?: "HTTP ${res.code}", res.code)
            }
            body
        }
    }
}

class ApiException(message: String, val status: Int) : IOException(message)

val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

fun jsonBody(value: String): RequestBody = value.toRequestBody(JSON_MEDIA)

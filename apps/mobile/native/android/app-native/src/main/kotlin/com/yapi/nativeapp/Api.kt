package com.yapi.nativeapp

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.Request

/** Cliente de la API de dominio (worker Cloudflare), autenticado con el ID token. */
object Api {
    private val json = Net.json

    private suspend fun authed(
        context: Context,
        method: String,
        path: String,
        body: String? = null,
    ): String {
        val token = Session.freshIdToken(context) ?: throw ApiException("No autenticado", 401)
        val builder = Request.Builder()
            .url(Config.WORKER_URL + path)
            .addHeader("Authorization", "Bearer $token")
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> if (body != null) builder.delete(jsonBody(body)) else builder.delete()
            else -> builder.method(method, jsonBody(body ?: "{}"))
        }
        return Net.call(builder.build())
    }

    suspend fun me(context: Context): User =
        json.decodeFromString(User.serializer(), authed(context, "GET", "/auth/me"))

    /** /auth/me con un token explícito (usado en el login, antes de guardar sesión). */
    suspend fun meWithToken(token: String): User {
        val req = Request.Builder()
            .url(Config.WORKER_URL + "/auth/me")
            .addHeader("Authorization", "Bearer $token")
            .get()
            .build()
        return json.decodeFromString(User.serializer(), Net.call(req))
    }

    suspend fun listChannels(context: Context): List<Channel> =
        json.decodeFromString(ListSerializer(Channel.serializer()), authed(context, "GET", "/channels"))

    suspend fun activityFeed(context: Context): List<ActivityItem> =
        json.decodeFromString(
            ListSerializer(ActivityItem.serializer()),
            authed(context, "GET", "/activity"),
        )

    suspend fun acceptInvite(context: Context, channelId: String): Channel =
        json.decodeFromString(
            Channel.serializer(),
            authed(context, "POST", "/channels/$channelId/accept", "{}"),
        )

    suspend fun declineInvite(context: Context, channelId: String) {
        authed(context, "POST", "/channels/$channelId/decline", "{}")
    }

    @Serializable
    data class CreateChannelReq(
        val name: String,
        val description: String = "",
        val enabled: Boolean = true,
        val subscriberIds: List<String> = emptyList(),
        val deviceIds: List<String> = emptyList(),
        val appIds: List<String> = emptyList(),
    )

    suspend fun createChannel(context: Context, req: CreateChannelReq): Channel =
        json.decodeFromString(
            Channel.serializer(),
            authed(context, "POST", "/channels", json.encodeToString(CreateChannelReq.serializer(), req)),
        )

    @Serializable
    data class UpdateChannelReq(
        val id: String,
        val name: String? = null,
        val description: String? = null,
        val enabled: Boolean? = null,
        val subscriberIds: List<String>? = null,
        val deviceIds: List<String>? = null,
        val appIds: List<String>? = null,
    )

    suspend fun updateChannel(context: Context, req: UpdateChannelReq): Channel =
        json.decodeFromString(
            Channel.serializer(),
            authed(context, "PUT", "/channels/${req.id}", json.encodeToString(UpdateChannelReq.serializer(), req)),
        )

    suspend fun deleteChannel(context: Context, id: String) {
        authed(context, "DELETE", "/channels/$id")
    }

    suspend fun listDevices(context: Context): List<Device> =
        json.decodeFromString(ListSerializer(Device.serializer()), authed(context, "GET", "/devices"))

    @Serializable
    data class RegisterDeviceReq(
        val name: String? = null,
        val platform: String? = null,
        val apps: List<AppRef>? = null,
    )

    suspend fun registerDevice(context: Context, req: RegisterDeviceReq): Device =
        json.decodeFromString(
            Device.serializer(),
            authed(context, "POST", "/devices", json.encodeToString(RegisterDeviceReq.serializer(), req)),
        )

    @Serializable
    data class UpdateDeviceReq(
        val id: String,
        val name: String? = null,
        val notifier: Boolean? = null,
        val apps: List<AppRef>? = null,
    )

    suspend fun updateDevice(context: Context, req: UpdateDeviceReq): Device =
        json.decodeFromString(
            Device.serializer(),
            authed(context, "PATCH", "/devices/${req.id}", json.encodeToString(UpdateDeviceReq.serializer(), req)),
        )

    suspend fun deleteDevice(context: Context, id: String) {
        authed(context, "DELETE", "/devices/$id")
    }

    @Serializable
    data class UsersResp(val list: List<User> = emptyList())

    suspend fun listUsers(context: Context): List<User> =
        json.decodeFromString(ListSerializer(User.serializer()), authed(context, "GET", "/users"))
}

package com.yapi.nativeapp

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/* Espejo de @yapi/contract. `package` es palabra reservada en Kotlin → SerialName. */

@Serializable
data class User(
    val id: String,
    val name: String,
    val handle: String,
    val email: String? = null,
    val phone: String? = null,
    val color: String,
)

@Serializable
data class AppInfo(
    val id: String,
    @SerialName("package") val pkg: String,
    val label: String,
)

@Serializable
data class AppRef(
    @SerialName("package") val pkg: String,
    val label: String,
)

@Serializable
data class Schedule(
    val days: List<Int>? = null,
    val start: String? = null,
    val end: String? = null,
)

@Serializable
data class ChannelNotification(
    val id: String,
    val title: String,
    val description: String,
    val sourceApp: String,
    val timestamp: String,
)

@Serializable
data class ChannelIntegration(
    val id: String,
    val url: String,
    val enabled: Boolean,
    val createdAt: String,
)

@Serializable
data class Channel(
    val id: String,
    val name: String,
    val description: String,
    val enabled: Boolean,
    val publisher: User,
    val subscribers: List<User> = emptyList(),
    val pendingInvites: List<User> = emptyList(),
    val notifications: List<ChannelNotification> = emptyList(),
    val deviceIds: List<String> = emptyList(),
    val appIds: List<String> = emptyList(),
    val integrations: List<ChannelIntegration> = emptyList(),
    val schedule: Schedule = Schedule(),
    val isOwner: Boolean = false,
    val isSubscribed: Boolean = false,
    val isInvited: Boolean = false,
)

@Serializable
data class Device(
    val id: String,
    val name: String,
    val platform: String,
    val notifier: Boolean,
    val hasToken: Boolean,
    val apps: List<AppInfo> = emptyList(),
    val createdAt: String,
)

@Serializable
data class ActivityItem(
    val id: String,
    val type: String, // "notification" | "invitation"
    val channelId: String,
    val channelName: String,
    val title: String,
    val description: String,
    val sourceApp: String? = null,
    val timestamp: String,
)

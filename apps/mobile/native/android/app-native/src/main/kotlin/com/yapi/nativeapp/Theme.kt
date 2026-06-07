package com.yapi.nativeapp

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Paleta de yapi (igual que el tema de la app Lynx). */
object Yapi {
    val bg = Color(0xFF0B0B0F)
    val surface = Color(0xFF16181D)
    val surfaceAlt = Color(0xFF111317)
    val surfaceInput = Color(0xFF0F1115)
    val surfaceMuted = Color(0xFF1D2127)
    val border = Color(0xFF23262D)
    val primary = Color(0xFF2F6FED)
    val primarySoft = Color(0xFF1D2A4D)
    val primarySoftText = Color(0xFF7AA2F7)
    val text = Color(0xFFFFFFFF)
    val textSecondary = Color(0xFFC4C8CF)
    val textMuted = Color(0xFF9AA0AA)
    val textFaint = Color(0xFF80868F)
    val danger = Color(0xFFEF4444)
    val success = Color(0xFF22C55E)
    val check = Color(0xFF16A34A)
}

private val DarkColors = darkColorScheme(
    primary = Yapi.primary,
    onPrimary = Yapi.text,
    background = Yapi.bg,
    onBackground = Yapi.text,
    surface = Yapi.surface,
    onSurface = Yapi.text,
    error = Yapi.danger,
)

@Composable
fun YapiTheme(content: @Composable () -> Unit) {
    @Suppress("UNUSED_EXPRESSION")
    isSystemInDarkTheme() // yapi es siempre oscuro
    MaterialTheme(colorScheme = DarkColors, content = content)
}

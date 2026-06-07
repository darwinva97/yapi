package com.yapi.nativeapp

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

private enum class Tab(val label: String) { Canales("Canales"), Novedades("Novedades"), Config("Configuración") }

@Composable
fun HomeScreen(user: User, onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(Tab.Canales) }
    var editorOpen by remember { mutableStateOf(false) }
    var editChannel by remember { mutableStateOf<Channel?>(null) }
    var channelsReload by remember { mutableStateOf(0) }

    if (editorOpen) {
        ChannelEditorScreen(
            channel = editChannel,
            onClose = { changed ->
                editorOpen = false
                if (changed) channelsReload++
            },
        )
        return
    }

    Scaffold(
        containerColor = Yapi.bg,
        bottomBar = {
            NavigationBar(containerColor = Yapi.surfaceAlt) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { tab = t },
                        icon = {
                            Icon(
                                when (t) {
                                    Tab.Canales -> Icons.Default.Wifi
                                    Tab.Novedades -> Icons.Default.Notifications
                                    Tab.Config -> Icons.Default.Settings
                                },
                                contentDescription = t.label,
                            )
                        },
                        label = { Text(t.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Yapi.primary,
                            selectedTextColor = Yapi.primary,
                            unselectedIconColor = Yapi.textMuted,
                            unselectedTextColor = Yapi.textMuted,
                            indicatorColor = Color.Transparent,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                Tab.Canales -> ChannelsScreen(
                    reloadKey = channelsReload,
                    onCreate = { editChannel = null; editorOpen = true },
                    onEdit = { editChannel = it; editorOpen = true },
                )
                Tab.Novedades -> ActivityScreen()
                Tab.Config -> ConfigScreen(user = user, onLogout = onLogout)
            }
        }
    }
}

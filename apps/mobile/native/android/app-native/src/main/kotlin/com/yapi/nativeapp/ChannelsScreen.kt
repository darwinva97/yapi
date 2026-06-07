package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private enum class Filter(val label: String) { Todos("Todos"), Propios("Propios"), Otros("Otros") }

@Composable
fun ChannelsScreen(reloadKey: Int, onCreate: () -> Unit, onEdit: (Channel) -> Unit) {
    val context = LocalContext.current
    var channels by remember { mutableStateOf<List<Channel>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var filter by remember { mutableStateOf(Filter.Todos) }

    LaunchedEffect(reloadKey) {
        try { channels = Api.listChannels(context) } catch (e: Exception) { error = e.message }
    }

    val visible = (channels ?: emptyList()).filter {
        when (filter) {
            Filter.Propios -> it.isOwner
            Filter.Otros -> it.isSubscribed && !it.isOwner
            Filter.Todos -> it.isOwner || it.isSubscribed
        }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(20.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text("Canales", color = Yapi.text, fontSize = 26.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            androidx.compose.foundation.layout.Box(
                Modifier.size(44.dp).clip(androidx.compose.foundation.shape.CircleShape)
                    .background(Yapi.primary).clickable { onCreate() },
                contentAlignment = androidx.compose.ui.Alignment.Center,
            ) { Text("+", color = Yapi.text, fontSize = 26.sp, fontWeight = FontWeight.Bold) }
        }

        Spacer(Modifier.height(16.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Yapi.surface).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Filter.entries.forEach { f ->
                val on = filter == f
                Text(
                    f.label,
                    color = if (on) Yapi.text else Yapi.textMuted,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(9.dp))
                        .background(if (on) Yapi.primary else androidx.compose.ui.graphics.Color.Transparent)
                        .clickable { filter = f }
                        .padding(vertical = 9.dp),
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        when {
            error != null -> Text(error!!, color = Yapi.danger, fontSize = 14.sp)
            channels == null -> Text("Cargando…", color = Yapi.textMuted, fontSize = 13.sp)
            else -> {
                Text("${visible.size} canal${if (visible.size == 1) "" else "es"}", color = Yapi.textMuted, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                if (visible.isEmpty()) {
                    Text("No hay canales en esta vista.", color = Yapi.textFaint, fontSize = 14.sp)
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(visible, key = { it.id }) { ch ->
                            ChannelCard(ch) { if (ch.isOwner) onEdit(ch) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelCard(channel: Channel, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Yapi.surface)
            .clickable { onClick() }.padding(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text(channel.name, color = Yapi.text, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (channel.isOwner) Text("editar ›", color = Yapi.textMuted, fontSize = 12.sp)
        }
        if (channel.description.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(channel.description, color = Yapi.textSecondary, fontSize = 13.sp)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            "${channel.subscribers.size} suscriptor${if (channel.subscribers.size == 1) "" else "es"}" +
                if (channel.isOwner) " · propio" else "",
            color = Yapi.textMuted, fontSize = 12.sp,
        )
    }
}

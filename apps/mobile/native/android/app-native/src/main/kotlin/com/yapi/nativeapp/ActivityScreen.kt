package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@Composable
fun ActivityScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<ActivityItem>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(reloadKey) {
        try { items = Api.activityFeed(context) } catch (e: Exception) { error = e.message }
    }

    fun respond(item: ActivityItem, accept: Boolean) {
        scope.launch {
            try {
                if (accept) Api.acceptInvite(context, item.channelId)
                else Api.declineInvite(context, item.channelId)
                reloadKey++
            } catch (_: Exception) { /* noop */ }
        }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(20.dp))
        Text("Novedades", color = Yapi.text, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))

        when {
            error != null -> Text(error!!, color = Yapi.danger, fontSize = 14.sp)
            items == null -> Text("Cargando…", color = Yapi.textMuted, fontSize = 13.sp)
            items!!.isEmpty() -> Text("No tienes novedades por ahora.", color = Yapi.textFaint, fontSize = 14.sp)
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(items!!, key = { it.id }) { item ->
                    if (item.type == "invitation") InvitationCard(item, { respond(item, true) }, { respond(item, false) })
                    else NotificationCard(item)
                }
            }
        }
    }
}

@Composable
private fun InvitationCard(item: ActivityItem, onAccept: () -> Unit, onDecline: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Yapi.surface)
            .border(1.dp, Yapi.primary, RoundedCornerShape(14.dp)).padding(16.dp),
    ) {
        Text("Invitación", color = Yapi.primarySoftText, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(item.channelName, color = Yapi.text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(item.description, color = Yapi.textMuted, fontSize = 13.sp)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = onAccept,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
            ) { Text("Aceptar", color = Yapi.text, fontWeight = FontWeight.Bold) }
            Button(
                onClick = onDecline,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.surfaceMuted),
            ) { Text("Rechazar", color = Yapi.textSecondary, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun NotificationCard(item: ActivityItem) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Yapi.surface).padding(16.dp),
    ) {
        Text(
            item.channelName + (item.sourceApp?.let { " · $it" } ?: ""),
            color = Yapi.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(item.title, color = Yapi.text, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        if (item.description.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(item.description, color = Yapi.textSecondary, fontSize = 13.sp)
        }
    }
}

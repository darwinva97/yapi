package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private enum class ConfigTab(val label: String) { Perfil("Perfil"), Dispositivos("Dispositivos") }

@Composable
fun ConfigScreen(user: User, onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(ConfigTab.Perfil) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(20.dp))
        Text("Configuración", color = Yapi.text, fontSize = 26.sp, fontWeight = FontWeight.Bold)

        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth()) {
            ConfigTab.entries.forEach { t ->
                val on = tab == t
                Text(
                    t.label,
                    color = if (on) Yapi.text else Yapi.textMuted,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f).clickable { tab = t }.padding(vertical = 10.dp),
                )
            }
        }
        Box(Modifier.fillMaxWidth().height(2.dp).background(Yapi.border))
        Spacer(Modifier.height(20.dp))

        when (tab) {
            ConfigTab.Perfil -> ProfileSection(user, onLogout)
            ConfigTab.Dispositivos -> DevicesSection()
        }
        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun ProfileSection(user: User, onLogout: () -> Unit) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        val initial = user.name.firstOrNull()?.uppercase() ?: "?"
        Box(Modifier.size(96.dp).background(Yapi.primary, CircleShape), Alignment.Center) {
            Text(initial, color = Yapi.text, fontSize = 44.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(12.dp))
        Text(user.name, color = Yapi.text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("@${user.handle}", color = Yapi.textMuted, fontSize = 14.sp)

        Spacer(Modifier.height(24.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Yapi.surface).padding(16.dp),
        ) {
            InfoRow("Usuario", "@${user.handle}")
            if (user.email != null) {
                Spacer(Modifier.height(12.dp))
                InfoRow("Email", user.email)
            }
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            border = androidx.compose.foundation.BorderStroke(1.dp, Yapi.danger),
        ) { Text("Cerrar sesión", color = Yapi.danger, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Yapi.textMuted, fontSize = 14.sp)
        Text(value, color = Yapi.text, fontSize = 14.sp)
    }
}

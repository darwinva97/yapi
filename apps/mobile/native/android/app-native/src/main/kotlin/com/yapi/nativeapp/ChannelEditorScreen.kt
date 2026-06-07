package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@Composable
fun ChannelEditorScreen(channel: Channel?, onClose: (changed: Boolean) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val editing = channel != null

    var name by remember { mutableStateOf(channel?.name ?: "") }
    var description by remember { mutableStateOf(channel?.description ?: "") }
    var devices by remember { mutableStateOf<List<Device>>(emptyList()) }
    var users by remember { mutableStateOf<List<User>>(emptyList()) }
    var selDevices by remember { mutableStateOf(channel?.deviceIds?.toSet() ?: emptySet()) }
    var selApps by remember { mutableStateOf(channel?.appIds?.toSet() ?: emptySet()) }
    var selMembers by remember {
        mutableStateOf(
            ((channel?.subscribers ?: emptyList()) + (channel?.pendingInvites ?: emptyList()))
                .map { it.id }.toSet(),
        )
    }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            devices = Api.listDevices(context)
            users = Api.listUsers(context)
        } catch (e: Exception) {
            error = e.message
        }
    }

    val availableApps = remember(devices) { devices.flatMap { it.apps }.distinctBy { it.id } }

    fun save() {
        if (saving) return
        if (name.isBlank()) { error = "Ponle un nombre al canal"; return }
        error = null
        saving = true
        scope.launch {
            try {
                if (editing) {
                    Api.updateChannel(
                        context,
                        Api.UpdateChannelReq(
                            id = channel!!.id, name = name, description = description,
                            subscriberIds = selMembers.toList(), deviceIds = selDevices.toList(),
                            appIds = selApps.toList(),
                        ),
                    )
                } else {
                    Api.createChannel(
                        context,
                        Api.CreateChannelReq(
                            name = name, description = description,
                            subscriberIds = selMembers.toList(), deviceIds = selDevices.toList(),
                            appIds = selApps.toList(),
                        ),
                    )
                }
                onClose(true)
            } catch (e: Exception) {
                error = e.message ?: "No se pudo guardar"
                saving = false
            }
        }
    }

    Column(Modifier.fillMaxSize().background(Yapi.bg).statusBarsPadding()) {
        // Cabecera
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Volver",
                tint = Yapi.text,
                modifier = Modifier.size(28.dp).clickable { onClose(false) },
            )
            Spacer(Modifier.size(8.dp))
            Text(
                if (editing) "Editar canal" else "Crear canal",
                color = Yapi.text, fontSize = 20.sp, fontWeight = FontWeight.Bold,
            )
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            Section("Información")
            Input(name, { name = it }, "Nombre")
            Spacer(Modifier.height(10.dp))
            Input(description, { description = it }, "Descripción")

            Spacer(Modifier.height(20.dp))
            Section("Mis dispositivos (de dónde reenvía)")
            if (devices.isEmpty()) Hint("Aún no tienes dispositivos.")
            devices.forEach { d ->
                CheckRow("${d.name} · ${d.platform}", selDevices.contains(d.id)) {
                    selDevices = if (selDevices.contains(d.id)) selDevices - d.id else selDevices + d.id
                }
            }

            Spacer(Modifier.height(20.dp))
            Section("Apps a reenviar")
            if (availableApps.isEmpty()) Hint("Configura apps en tus dispositivos (Configuración → Dispositivos).")
            availableApps.forEach { a ->
                CheckRow(a.label, selApps.contains(a.id)) {
                    selApps = if (selApps.contains(a.id)) selApps - a.id else selApps + a.id
                }
            }

            Spacer(Modifier.height(20.dp))
            Section("Miembros (a quién reenvía)")
            if (users.isEmpty()) Hint("No hay otros usuarios para invitar.")
            users.forEach { u ->
                CheckRow("${u.name}  ·  @${u.handle}", selMembers.contains(u.id)) {
                    selMembers = if (selMembers.contains(u.id)) selMembers - u.id else selMembers + u.id
                }
            }

            if (error != null) {
                Spacer(Modifier.height(14.dp))
                Text(error!!, color = Yapi.danger, fontSize = 13.sp)
            }

            if (editing) {
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = {
                        scope.launch {
                            try { Api.deleteChannel(context, channel!!.id); onClose(true) }
                            catch (e: Exception) { error = e.message }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Yapi.danger),
                ) { Text("Eliminar canal", color = Yapi.danger, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.height(24.dp))
        }

        // Barra de guardar
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp)) {
            Button(
                onClick = { save() },
                enabled = !saving,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
            ) {
                if (saving) CircularProgressIndicator(color = Yapi.text, modifier = Modifier.size(22.dp))
                else Text(if (editing) "Guardar cambios" else "Crear canal", color = Yapi.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun Section(title: String) {
    Text(title, color = Yapi.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(10.dp))
}

@Composable
private fun Hint(text: String) {
    Text(text, color = Yapi.textFaint, fontSize = 13.sp)
}

@Composable
private fun Input(value: String, onChange: (String) -> Unit, placeholder: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = Yapi.textFaint) },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Yapi.text,
            unfocusedTextColor = Yapi.text,
            focusedContainerColor = Yapi.surface,
            unfocusedContainerColor = Yapi.surface,
            focusedBorderColor = Yapi.primary,
            unfocusedBorderColor = Yapi.border,
            cursorColor = Yapi.primary,
        ),
    )
}

@Composable
private fun CheckRow(label: String, checked: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onToggle() }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = Yapi.check, uncheckedColor = Yapi.textFaint),
        )
        Text(label, color = Yapi.text, fontSize = 15.sp)
    }
}

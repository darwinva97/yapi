package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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

private enum class EditorTab(val label: String) { Info("Información"), Users("Usuarios"), Integrations("Integraciones"), Notifs("Notificaciones") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChannelEditorScreen(channel: Channel?, onClose: (changed: Boolean) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val editing = channel != null

    var tab by remember { mutableStateOf(EditorTab.Info) }
    var name by remember { mutableStateOf(channel?.name ?: "") }
    var description by remember { mutableStateOf(channel?.description ?: "") }
    var enabled by remember { mutableStateOf(channel?.enabled ?: true) }
    var selDevices by remember { mutableStateOf(channel?.deviceIds?.toSet() ?: emptySet()) }
    var selApps by remember { mutableStateOf(channel?.appIds?.toSet() ?: emptySet()) }
    var selMembers by remember {
        mutableStateOf(
            ((channel?.subscribers ?: emptyList()) + (channel?.pendingInvites ?: emptyList()))
                .map { it.id }.toSet(),
        )
    }
    var schedDays by remember { mutableStateOf(channel?.schedule?.days?.toSet() ?: emptySet()) }
    var schedStart by remember { mutableStateOf(channel?.schedule?.start ?: "") }
    var schedEnd by remember { mutableStateOf(channel?.schedule?.end ?: "") }

    var devices by remember { mutableStateOf<List<Device>>(emptyList()) }
    var users by remember { mutableStateOf<List<User>>(emptyList()) }
    var notifications by remember { mutableStateOf(channel?.notifications ?: emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    var appsSheet by remember { mutableStateOf(false) }
    var inviteSheet by remember { mutableStateOf(false) }
    var scheduleSheet by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            devices = Api.listDevices(context)
            users = Api.listUsers(context)
        } catch (e: Exception) {
            error = e.message
        }
    }

    val availableApps = remember(devices, selDevices) {
        devices.filter { selDevices.contains(it.id) }.flatMap { it.apps }.distinctBy { it.id }
    }
    val userById = remember(users, channel) {
        (users + (channel?.subscribers ?: emptyList()) + (channel?.pendingInvites ?: emptyList()))
            .associateBy { it.id }
    }
    val pendingIds = remember(channel) { (channel?.pendingInvites ?: emptyList()).map { it.id }.toSet() }

    fun save() {
        if (saving) return
        if (name.isBlank()) { tab = EditorTab.Info; error = "Ponle un nombre al canal"; return }
        error = null
        saving = true
        val scheduleJson = if (schedDays.isEmpty() && schedStart.isBlank() && schedEnd.isBlank()) null
        else Api.scheduleJson(
            schedDays.toList().sorted().ifEmpty { null },
            schedStart.ifBlank { null },
            schedEnd.ifBlank { null },
        )
        scope.launch {
            try {
                if (editing) {
                    Api.updateChannel(
                        context,
                        Api.UpdateChannelReq(
                            id = channel!!.id, name = name, description = description, enabled = enabled,
                            subscriberIds = selMembers.toList(), deviceIds = selDevices.toList(),
                            appIds = selApps.toList(), schedule = scheduleJson,
                        ),
                    )
                } else {
                    Api.createChannel(
                        context,
                        Api.CreateChannelReq(
                            name = name, description = description, enabled = enabled,
                            subscriberIds = selMembers.toList(), deviceIds = selDevices.toList(),
                            appIds = selApps.toList(), schedule = scheduleJson,
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

    val tabs = if (editing) EditorTab.entries else EditorTab.entries.filter { it != EditorTab.Notifs }

    Column(Modifier.fillMaxSize().background(Yapi.bg).statusBarsPadding()) {
        // Cabecera
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = Yapi.text,
                modifier = Modifier.size(28.dp).clickable { onClose(false) },
            )
            Spacer(Modifier.size(8.dp))
            Text(
                if (editing) "Editar canal" else "Crear canal",
                color = Yapi.text, fontSize = 20.sp, fontWeight = FontWeight.Bold,
            )
        }

        // Pestañas (iconos)
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
            tabs.forEach { t ->
                val on = tab == t
                Column(
                    Modifier.weight(1f).clickable { tab = t }.padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        when (t) {
                            EditorTab.Info -> Icons.Default.Info
                            EditorTab.Users -> Icons.Default.People
                            EditorTab.Integrations -> Icons.Default.Extension
                            EditorTab.Notifs -> Icons.Default.Notifications
                        },
                        contentDescription = t.label,
                        tint = if (on) Yapi.primary else Yapi.textMuted,
                        modifier = Modifier.size(24.dp),
                    )
                    Spacer(Modifier.height(4.dp))
                    Box(
                        Modifier.height(2.dp).fillMaxWidth(0.7f)
                            .background(if (on) Yapi.primary else Color.Transparent),
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Yapi.border))

        // Contenido
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 16.dp)) {
            when (tab) {
                EditorTab.Info -> InfoTab(
                    name, { name = it }, description, { description = it },
                    channel?.publisher?.name, enabled, { enabled = !enabled },
                    devices, selDevices, { id -> selDevices = if (selDevices.contains(id)) selDevices - id else selDevices + id },
                    selApps.size, scheduleSummary(schedDays, schedStart, schedEnd),
                    onOpenApps = { appsSheet = true }, onOpenSchedule = { scheduleSheet = true },
                )
                EditorTab.Users -> UsersTab(
                    memberIds = selMembers, userById = userById, pendingIds = pendingIds,
                    onInvite = { inviteSheet = true },
                    onRemove = { id -> selMembers = selMembers - id },
                )
                EditorTab.Integrations -> IntegrationsTab()
                EditorTab.Notifs -> NotificationsTab(
                    channelId = channel?.id, notifications = notifications,
                    onPublished = { notifications = listOf(it) + notifications },
                )
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

        // Guardar
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp)) {
            Button(
                onClick = { save() }, enabled = !saving,
                modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
            ) {
                if (saving) CircularProgressIndicator(color = Yapi.text, modifier = Modifier.size(22.dp))
                else Text(if (editing) "Guardar cambios" else "Crear canal", color = Yapi.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }

    if (appsSheet) {
        val st = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        AppsChannelSheet(st, availableApps, selApps, { appsSheet = false }) { selApps = it; appsSheet = false }
    }
    if (inviteSheet) {
        val st = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        InviteSheet(st, users, selMembers, { inviteSheet = false }) { selMembers = it; inviteSheet = false }
    }
    if (scheduleSheet) {
        val st = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ScheduleSheet(st, schedDays, schedStart, schedEnd, { scheduleSheet = false }) { d, s, e ->
            schedDays = d; schedStart = s; schedEnd = e; scheduleSheet = false
        }
    }
}

/* ----------------------------- Información ----------------------------- */

@Composable
private fun InfoTab(
    name: String, onName: (String) -> Unit, description: String, onDescription: (String) -> Unit,
    publisher: String?, enabled: Boolean, onToggleEnabled: () -> Unit,
    devices: List<Device>, selDevices: Set<String>, onToggleDevice: (String) -> Unit,
    appCount: Int, scheduleText: String, onOpenApps: () -> Unit, onOpenSchedule: () -> Unit,
) {
    Label("Información")
    EditorInput(name, onName, "Nombre")
    Spacer(Modifier.height(10.dp))
    EditorInput(description, onDescription, "Descripción")
    if (publisher != null) {
        Spacer(Modifier.height(10.dp))
        RowItem("Publicador", publisher)
    }

    Spacer(Modifier.height(20.dp))
    Label("Suscripción")
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Yapi.surface).padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text("Estado", color = Yapi.text, fontSize = 15.sp)
        Switch(
            checked = enabled, onCheckedChange = { onToggleEnabled() },
            colors = SwitchDefaults.colors(checkedThumbColor = Yapi.text, checkedTrackColor = Yapi.success, uncheckedTrackColor = Yapi.surfaceMuted),
        )
    }
    Spacer(Modifier.height(12.dp))
    Text("Dispositivos (de dónde reenvía)", color = Yapi.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(6.dp))
    if (devices.isEmpty()) Text("Aún no tienes dispositivos.", color = Yapi.textFaint, fontSize = 13.sp)
    devices.forEach { d ->
        CheckItem("${d.name} · ${d.platform}", selDevices.contains(d.id)) { onToggleDevice(d.id) }
    }
    Spacer(Modifier.height(10.dp))
    TapRow("Apps", if (appCount == 0) "Ninguna ›" else "$appCount ›", onOpenApps)
    Spacer(Modifier.height(8.dp))
    TapRow("Horario", "$scheduleText ›", onOpenSchedule)
}

/* ------------------------------ Usuarios ------------------------------ */

@Composable
private fun UsersTab(
    memberIds: Set<String>, userById: Map<String, User>, pendingIds: Set<String>,
    onInvite: () -> Unit, onRemove: (String) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Usuarios", color = Yapi.text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text("${memberIds.size} miembro${if (memberIds.size == 1) "" else "s"}", color = Yapi.textMuted, fontSize = 13.sp)
    }
    Spacer(Modifier.height(12.dp))
    Button(
        onClick = onInvite, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Yapi.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, Yapi.primary),
    ) { Text("＋ Invitar usuario", color = Yapi.primary, fontWeight = FontWeight.Bold) }
    Spacer(Modifier.height(12.dp))
    if (memberIds.isEmpty()) {
        Text("Aún no has invitado a nadie.", color = Yapi.textFaint, fontSize = 14.sp)
    }
    memberIds.forEach { id ->
        val u = userById[id] ?: return@forEach
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(u.name, u.color)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(u.name, color = Yapi.text, fontSize = 15.sp)
                    if (pendingIds.contains(id)) {
                        Spacer(Modifier.size(8.dp))
                        Text(
                            "Pendiente", color = Yapi.primarySoftText, fontSize = 11.sp,
                            modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Yapi.primarySoft).padding(horizontal = 6.dp, vertical = 1.dp),
                        )
                    }
                }
                Text("@${u.handle}", color = Yapi.textFaint, fontSize = 12.sp)
            }
            Text("Quitar", color = Yapi.danger, fontSize = 13.sp, modifier = Modifier.clickable { onRemove(id) })
        }
    }
}

/* ---------------------------- Integraciones ---------------------------- */

@Composable
private fun IntegrationsTab() {
    Text("Integraciones", color = Yapi.text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(16.dp))
    Text("Aún no hay integraciones configuradas.", color = Yapi.textFaint, fontSize = 14.sp)
}

/* ---------------------------- Notificaciones --------------------------- */

@Composable
private fun NotificationsTab(
    channelId: String?, notifications: List<ChannelNotification>, onPublished: (ChannelNotification) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Text("Notificaciones", color = Yapi.text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))

    if (channelId != null) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Yapi.surface).padding(12.dp)) {
            EditorInput(title, { title = it }, "Título", surface = Yapi.surfaceInput)
            Spacer(Modifier.height(8.dp))
            EditorInput(desc, { desc = it }, "Descripción (opcional)", surface = Yapi.surfaceInput)
            if (error != null) { Spacer(Modifier.height(8.dp)); Text(error!!, color = Yapi.danger, fontSize = 12.sp) }
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = {
                    if (sending) return@Button
                    if (title.isBlank()) { error = "El título es obligatorio"; return@Button }
                    sending = true; error = null
                    scope.launch {
                        try {
                            val n = Api.createNotification(context, Api.CreateNotificationReq(channelId, title.trim(), desc))
                            onPublished(n); title = ""; desc = ""
                        } catch (e: Exception) { error = e.message ?: "No se pudo publicar" }
                        finally { sending = false }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(46.dp), shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
            ) {
                if (sending) CircularProgressIndicator(color = Yapi.text, modifier = Modifier.size(20.dp))
                else Text("Publicar", color = Yapi.text, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    if (notifications.isEmpty()) {
        Text("Sin notificaciones todavía.", color = Yapi.textFaint, fontSize = 14.sp)
    }
    notifications.forEach { n ->
        Column(Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(12.dp)).background(Yapi.surface).padding(14.dp)) {
            Text(n.sourceApp, color = Yapi.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(n.title, color = Yapi.text, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            if (n.description.isNotBlank()) { Spacer(Modifier.height(2.dp)); Text(n.description, color = Yapi.textSecondary, fontSize = 13.sp) }
        }
    }
}

/* ------------------------------- Sheets -------------------------------- */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppsChannelSheet(
    state: androidx.compose.material3.SheetState, apps: List<AppInfo>, selected: Set<String>,
    onDismiss: () -> Unit, onSave: (Set<String>) -> Unit,
) {
    var sel by remember { mutableStateOf(selected) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state, containerColor = Yapi.bg) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text("Apps del canal", color = Yapi.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Apps de los dispositivos seleccionados.", color = Yapi.textMuted, fontSize = 13.sp)
            Spacer(Modifier.height(10.dp))
            if (apps.isEmpty()) Text("Selecciona dispositivos con apps configuradas primero.", color = Yapi.textFaint, fontSize = 13.sp)
            LazyColumn(Modifier.heightIn(max = 360.dp)) {
                items(apps, key = { it.id }) { a ->
                    val on = sel.contains(a.id)
                    Row(Modifier.fillMaxWidth().clickable { sel = if (on) sel - a.id else sel + a.id }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(on, { sel = if (on) sel - a.id else sel + a.id }, colors = CheckboxDefaults.colors(checkedColor = Yapi.check, uncheckedColor = Yapi.textFaint))
                        Text(a.label, color = Yapi.text, fontSize = 15.sp, modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(onClick = { onSave(sel) }, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary)) {
                Text("Guardar", color = Yapi.text, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InviteSheet(
    state: androidx.compose.material3.SheetState, users: List<User>, selected: Set<String>,
    onDismiss: () -> Unit, onSave: (Set<String>) -> Unit,
) {
    var sel by remember { mutableStateOf(selected) }
    var query by remember { mutableStateOf("") }
    val filtered = if (query.isBlank()) users else users.filter { it.name.contains(query, true) || it.handle.contains(query, true) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state, containerColor = Yapi.bg) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text("Invitar usuarios", color = Yapi.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            EditorInput(query, { query = it }, "Buscar…", surface = Yapi.surface)
            Spacer(Modifier.height(8.dp))
            LazyColumn(Modifier.heightIn(max = 360.dp)) {
                items(filtered, key = { it.id }) { u ->
                    val on = sel.contains(u.id)
                    Row(Modifier.fillMaxWidth().clickable { sel = if (on) sel - u.id else sel + u.id }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(on, { sel = if (on) sel - u.id else sel + u.id }, colors = CheckboxDefaults.colors(checkedColor = Yapi.check, uncheckedColor = Yapi.textFaint))
                        Avatar(u.name, u.color)
                        Column(Modifier.padding(start = 10.dp)) {
                            Text(u.name, color = Yapi.text, fontSize = 15.sp)
                            Text("@${u.handle}", color = Yapi.textFaint, fontSize = 12.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(onClick = { onSave(sel) }, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary)) {
                Text("Listo", color = Yapi.text, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private val DAY_LABELS = listOf("D", "L", "M", "M", "J", "V", "S")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleSheet(
    state: androidx.compose.material3.SheetState, days: Set<Int>, start: String, end: String,
    onDismiss: () -> Unit, onSave: (Set<Int>, String, String) -> Unit,
) {
    var d by remember { mutableStateOf(days) }
    var s by remember { mutableStateOf(start) }
    var e by remember { mutableStateOf(end) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state, containerColor = Yapi.bg) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text("Horario", color = Yapi.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Vacío = siempre.", color = Yapi.textMuted, fontSize = 13.sp)
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                (0..6).forEach { day ->
                    val on = d.contains(day)
                    Box(
                        Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(8.dp))
                            .background(if (on) Yapi.primary else Yapi.surface)
                            .clickable { d = if (on) d - day else d + day },
                        contentAlignment = Alignment.Center,
                    ) { Text(DAY_LABELS[day], color = if (on) Yapi.text else Yapi.textMuted, fontWeight = FontWeight.Bold) }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { EditorInput(s, { s = it }, "Desde (HH:mm)", surface = Yapi.surface) }
                Box(Modifier.weight(1f)) { EditorInput(e, { e = it }, "Hasta (HH:mm)", surface = Yapi.surface) }
            }
            Spacer(Modifier.height(14.dp))
            Button(onClick = { onSave(d, s.trim(), e.trim()) }, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary)) {
                Text("Guardar", color = Yapi.text, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/* ------------------------------ helpers ------------------------------- */

private fun scheduleSummary(days: Set<Int>, start: String, end: String): String {
    if (days.isEmpty() && start.isBlank() && end.isBlank()) return "Siempre"
    val d = if (days.isEmpty()) "Todos los días" else days.sorted().joinToString(" ") { DAY_LABELS[it] }
    val time = if (start.isNotBlank() || end.isNotBlank()) "  ${start.ifBlank { "00:00" }}-${end.ifBlank { "23:59" }}" else ""
    return d + time
}

@Composable
private fun Label(text: String) {
    Text(text, color = Yapi.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(10.dp))
}

@Composable
private fun EditorInput(value: String, onChange: (String) -> Unit, placeholder: String, surface: Color = Yapi.surface) {
    OutlinedTextField(
        value = value, onValueChange = onChange,
        placeholder = { Text(placeholder, color = Yapi.textFaint) },
        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Yapi.text, unfocusedTextColor = Yapi.text,
            focusedContainerColor = surface, unfocusedContainerColor = surface,
            focusedBorderColor = Yapi.primary, unfocusedBorderColor = Yapi.border, cursorColor = Yapi.primary,
        ),
    )
}

@Composable
private fun RowItem(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Yapi.surface).padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Yapi.textMuted, fontSize = 14.sp)
        Text(value, color = Yapi.text, fontSize = 14.sp)
    }
}

@Composable
private fun TapRow(label: String, value: String, onTap: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Yapi.surface).clickable { onTap() }.padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Yapi.text, fontSize = 15.sp)
        Text(value, color = Yapi.textMuted, fontSize = 14.sp)
    }
}

@Composable
private fun CheckItem(label: String, checked: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { onToggle() }.padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked, { onToggle() }, colors = CheckboxDefaults.colors(checkedColor = Yapi.check, uncheckedColor = Yapi.textFaint))
        Text(label, color = Yapi.text, fontSize = 15.sp, modifier = Modifier.padding(start = 4.dp))
    }
}

@Composable
private fun Avatar(name: String, colorHex: String) {
    val c = runCatching { Color(android.graphics.Color.parseColor(colorHex)) }.getOrDefault(Yapi.primary)
    Box(Modifier.size(36.dp).clip(CircleShape).background(c), contentAlignment = Alignment.Center) {
        Text(name.firstOrNull()?.uppercase() ?: "?", color = Yapi.text, fontWeight = FontWeight.Bold)
    }
}

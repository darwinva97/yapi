package com.yapi.nativeapp

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevicesSection() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var device by remember { mutableStateOf<Device?>(null) }
    var installed by remember { mutableStateOf<List<AppRef>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var granted by remember { mutableStateOf(NotificationAccess.isGranted(context)) }
    var appsOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            device = Devices.ensureRegistered(context)
        } catch (e: Exception) {
            error = e.message
        }
        installed = withContext(Dispatchers.IO) { InstalledApps.list(context) }
    }

    // Re-chequear el permiso al volver de Ajustes.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) granted = NotificationAccess.isGranted(context)
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    Column(Modifier.fillMaxWidth()) {
        Text("Dispositivos", color = Yapi.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))

        if (!granted) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                    .border(1.dp, Yapi.primary, RoundedCornerShape(14.dp)).padding(16.dp),
            ) {
                Text("Activa el reenvío de notificaciones", color = Yapi.text, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Concede \"Acceso a notificaciones\" para que yapi lea las apps que elijas y las reenvíe a tus canales.",
                    color = Yapi.textMuted, fontSize = 13.sp,
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { NotificationAccess.openSettings(context) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
                ) { Text("Conceder acceso", color = Yapi.text, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.height(16.dp))
        }

        when {
            error != null -> Text(error!!, color = Yapi.danger, fontSize = 14.sp)
            device == null -> Text("Cargando…", color = Yapi.textMuted, fontSize = 13.sp)
            else -> DeviceCard(
                device = device!!,
                onOpenApps = { appsOpen = true },
                onToggleNotifier = {
                    scope.launch {
                        try {
                            val d = Api.updateDevice(context, Api.UpdateDeviceReq(id = device!!.id, notifier = !device!!.notifier))
                            device = d
                            Devices.syncListener(context, d)
                        } catch (_: Exception) {}
                    }
                },
            )
        }
    }

    if (appsOpen && device != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        AppsSheet(
            sheetState = sheetState,
            installed = installed,
            initiallySelected = device!!.apps.map { it.pkg }.toSet(),
            onDismiss = { appsOpen = false },
            onSave = { selected ->
                scope.launch {
                    try {
                        val apps = installed.filter { selected.contains(it.pkg) }
                        val d = Api.updateDevice(context, Api.UpdateDeviceReq(id = device!!.id, apps = apps))
                        device = d
                        Devices.syncListener(context, d)
                    } catch (_: Exception) {}
                    appsOpen = false
                }
            },
        )
    }
}

@Composable
private fun DeviceCard(device: Device, onOpenApps: () -> Unit, onToggleNotifier: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Yapi.surface).padding(16.dp),
    ) {
        Text(device.name, color = Yapi.text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(device.platform, color = Yapi.textFaint, fontSize = 12.sp)
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Yapi.surfaceInput)
                .clickable { onOpenApps() }.padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Apps con notificaciones", color = Yapi.text, fontSize = 15.sp)
            Text(
                if (device.apps.isEmpty()) "Ninguna ›" else "${device.apps.size} app${if (device.apps.size == 1) "" else "s"} ›",
                color = Yapi.textMuted, fontSize = 14.sp,
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Notificador", color = Yapi.textMuted, fontSize = 14.sp)
            Switch(
                checked = device.notifier,
                onCheckedChange = { onToggleNotifier() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Yapi.text,
                    checkedTrackColor = Yapi.success,
                    uncheckedTrackColor = Yapi.surfaceMuted,
                ),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppsSheet(
    sheetState: androidx.compose.material3.SheetState,
    installed: List<AppRef>,
    initiallySelected: Set<String>,
    onDismiss: () -> Unit,
    onSave: (Set<String>) -> Unit,
) {
    var selected by remember { mutableStateOf(initiallySelected) }
    var query by remember { mutableStateOf("") }
    val filtered = if (query.isBlank()) installed
    else installed.filter { it.label.contains(query, ignoreCase = true) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = Yapi.bg) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text("Apps a escuchar", color = Yapi.text, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Elige de qué apps reenviar notificaciones.", color = Yapi.textMuted, fontSize = 13.sp)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Buscar…", color = Yapi.textFaint) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
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
            Spacer(Modifier.height(8.dp))
            LazyColumn(Modifier.heightIn(max = 380.dp)) {
                items(filtered, key = { it.pkg }) { app ->
                    val on = selected.contains(app.pkg)
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            selected = if (on) selected - app.pkg else selected + app.pkg
                        }.padding(vertical = 6.dp),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = on,
                            onCheckedChange = { selected = if (on) selected - app.pkg else selected + app.pkg },
                            colors = CheckboxDefaults.colors(checkedColor = Yapi.check, uncheckedColor = Yapi.textFaint),
                        )
                        Spacer(Modifier.height(0.dp))
                        Text(app.label, color = Yapi.text, fontSize = 15.sp, modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { onSave(selected) },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
            ) { Text("Guardar", color = Yapi.text, fontWeight = FontWeight.Bold) }
        }
    }
}

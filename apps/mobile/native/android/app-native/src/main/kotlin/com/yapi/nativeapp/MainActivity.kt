package com.yapi.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val requestNotifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Notifications.ensureChannel(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestNotifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        setContent {
            YapiTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Yapi.bg) {
                    AppRoot()
                }
            }
        }
    }
}

private sealed interface Phase {
    data object Loading : Phase
    data object Login : Phase
    data class Home(val user: User) : Phase
}

@Composable
fun AppRoot() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var phase by remember { mutableStateOf<Phase>(Phase.Loading) }

    // Restaurar sesión persistida al arrancar.
    LaunchedEffect(Unit) {
        val token = Session.freshIdToken(context)
        phase = if (token != null) {
            val u = runCatching { Api.me(context) }.getOrNull()
            if (u != null) {
                Session.load(context)?.let { Session.save(context, it.copy(user = u)) }
                Phase.Home(u)
            } else Phase.Login
        } else {
            Phase.Login
        }
    }

    when (val p = phase) {
        is Phase.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
            CircularProgressIndicator(color = Yapi.primary)
        }
        is Phase.Login -> LoginScreen(onLoggedIn = { phase = Phase.Home(it) })
        is Phase.Home -> HomeScreen(
            user = p.user,
            onLogout = {
                scope.launch { Session.clear(context) }
                phase = Phase.Login
            },
        )
    }
}

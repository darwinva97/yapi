package com.yapi.nativeapp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onLoggedIn: (User) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var register by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var googleLoading by remember { mutableStateOf(false) }

    fun googleSignIn() {
        if (googleLoading) return
        error = null
        googleLoading = true
        scope.launch {
            try {
                onLoggedIn(GoogleAuth.signIn(context))
            } catch (e: Exception) {
                android.util.Log.w("YapiNative", "google error: ${e.message}", e)
                error = e.message ?: "No se pudo entrar con Google"
            } finally {
                googleLoading = false
            }
        }
    }

    fun submit() {
        if (loading) return
        error = null
        if (email.isBlank() || pass.isBlank()) { error = "Completa correo y contraseña"; return }
        if (register && pass != confirm) { error = "Las contraseñas no coinciden"; return }
        if (register && pass.length < 6) { error = "La contraseña debe tener al menos 6 caracteres"; return }
        loading = true
        scope.launch {
            try {
                val fb = if (register) FirebaseAuth.signUp(email.trim(), pass)
                else FirebaseAuth.signIn(email.trim(), pass)
                val user = Api.meWithToken(fb.idToken)
                Session.save(context, StoredSession(fb.idToken, fb.refreshToken, fb.expiresAt, user))
                onLoggedIn(user)
            } catch (e: Exception) {
                android.util.Log.w("YapiNative", "login error: ${e::class.java.simpleName}: ${e.message}", e)
                error = e.message ?: "No se pudo iniciar sesión"
            } finally {
                loading = false
            }
        }
    }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier.size(76.dp).background(Yapi.primary, CircleShape),
            Alignment.Center,
        ) { Text("y", color = Yapi.text, fontSize = 40.sp, fontWeight = FontWeight.Bold) }
        Spacer(Modifier.height(16.dp))
        Text("yapi", color = Yapi.text, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text(
            if (register) "Crea tu cuenta con correo" else "Inicia sesión con tu correo",
            color = Yapi.textMuted, fontSize = 15.sp,
        )
        Spacer(Modifier.height(28.dp))

        Field("Correo", email, { email = it }, KeyboardType.Email)
        Spacer(Modifier.height(14.dp))
        Field("Contraseña", pass, { pass = it }, KeyboardType.Password, password = true)
        if (register) {
            Spacer(Modifier.height(14.dp))
            Field("Confirmar contraseña", confirm, { confirm = it }, KeyboardType.Password, password = true)
        }

        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = Yapi.danger, fontSize = 13.sp)
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { submit() },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Yapi.primary),
        ) {
            if (loading) CircularProgressIndicator(color = Yapi.text, modifier = Modifier.size(22.dp))
            else Text(if (register) "Crear cuenta" else "Entrar", color = Yapi.text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(16.dp))
        Text("o", color = Yapi.textFaint, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { googleSignIn() },
            enabled = !googleLoading,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Yapi.surface),
            border = androidx.compose.foundation.BorderStroke(1.dp, Yapi.border),
        ) {
            if (googleLoading) CircularProgressIndicator(color = Yapi.text, modifier = Modifier.size(22.dp))
            else Text("Continuar con Google", color = Yapi.text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(12.dp))
        TextButton(onClick = { register = !register; error = null }) {
            Text(
                if (register) "¿Ya tienes cuenta? Inicia sesión" else "¿No tienes cuenta? Regístrate",
                color = Yapi.primary, fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    keyboard: KeyboardType,
    password: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, color = Yapi.textMuted) },
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
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

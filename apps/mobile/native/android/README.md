# Push notifications en la app Lynx (Android)

Para que un push llegue a **tu** app Lynx necesitas un **host app nativo Android** que embeba
`LynxView`. LynxExplorer (la app de preview) **no** sirve: no está ligada a tu proyecto
Firebase `yapi-46b53` ni tiene tu `FcmModule`.

Este directorio contiene las piezas listas para ese host app:

```
android/
├── app/
│   ├── google-services.json                      ← YA GENERADO (proyecto yapi-46b53, com.yapi.app)
│   └── src/main/kotlin/com/yapi/app/
│       └── YapiFirebaseMessagingService.kt        ← recibe/muestra notificaciones
└── fcm/                                            ← módulo: NativeModule FcmModule (token FCM)
    ├── build.gradle.kts
    └── src/main/kotlin/com/yapi/fcm/FcmModule.kt
```

> **Requisitos que esta máquina no tiene** (por eso no se puede compilar/ejecutar aquí):
> Android SDK + build-tools, Gradle, y un dispositivo/emulador. Necesitas Android Studio.

Datos ya provisionados en Firebase:
- **applicationId**: `com.yapi.app` (debe coincidir con el del host app)
- **Android appId**: `1:174017374070:android:d8ec9021da41f31e1e3c57`
- `google-services.json` ya descargado en `app/`.

## Pasos en el host app

### 1. Firebase / Gradle

`app/build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.yapi.app"
    defaultConfig { applicationId = "com.yapi.app" }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation(project(":fcm"))            // el módulo FcmModule de este repo
    // + dependencias del SDK de Lynx (ver paso 3)
}
```
Coloca `app/google-services.json` (ya está aquí) en el módulo `app` del host app.

### 2. AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<application ...>
    <service
        android:name="com.yapi.app.YapiFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>
</application>
```
En Android 13+ pide en runtime el permiso `POST_NOTIFICATIONS`.

### 3. Embeber Lynx y registrar el módulo

Sigue la guía oficial *Integrate Lynx with an Existing App* (las coordenadas/versión del
SDK de Lynx dependen de la release). En esencia:

```kotlin
// Application.onCreate()
import com.lynx.tasm.LynxEnv
import com.yapi.fcm.FcmModule

LynxEnv.inst().init(this, null, null, null)
LynxEnv.inst().registerModule("FcmModule", FcmModule::class.java)

// En tu Activity: crear un LynxView y cargar el bundle.
// - En dev: la URL del servidor de rspeedy (p. ej. http://<IP-LAN>:3000/main.lynx.bundle)
// - En release: el .lynx.bundle empaquetado en assets (pnpm --filter @yapi/mobile build)
```

### 4. Flujo (ya implementado en JS)

`apps/mobile/src/`:
- `fcm.ts` → `NativeModules.FcmModule.getToken(...)`.
- `App.tsx` → al iniciar registra el token en `POST /api/devices`; el botón dispara `POST /api/push`.

Al pulsar el botón: token real del dispositivo → nuestro `server` → firebase-admin → FCM →
`YapiFirebaseMessagingService` muestra la notificación. 🎉

## Login social nativo (Google / Facebook)

El módulo `auth/` (NativeModule `SocialAuthModule`) abre el SDK nativo y devuelve
una credencial que el worker valida:

```
auth/
├── build.gradle.kts
└── src/main/
    ├── AndroidManifest.xml                         ← Activities/meta-data de Facebook
    ├── res/values/strings.xml                      ← RELLENA tus client ids aquí
    └── kotlin/com/yapi/auth/
        ├── SocialAuthModule.kt                     ← signInGoogle / signInFacebook
        └── CurrentActivity.kt                      ← Activity actual + CallbackManager
```

Lado JS (ya implementado): `apps/mobile/src/socialAuth.ts` →
`NativeModules.SocialAuthModule.signInGoogle/Facebook((credential) => …)`. La
credencial va a `POST /auth/google` · `/auth/facebook` y el worker la valida.
En el preview web (sin SDK nativo) la pantalla cae a un mock por correo.

### Pasos

1. **Registrado ya** en `YapiApp.onCreate`:
   `LynxEnv.inst().registerModule("SocialAuthModule", SocialAuthModule.class)`.
2. **`MainActivity`** publica su Activity en `CurrentActivity` y reenvía
   `onActivityResult` al `CallbackManager` de Facebook (ya hecho).
3. **Credenciales** en `auth/src/main/res/values/strings.xml` (son placeholders):
   - `google_server_client_id`: el **Web client id** de OAuth (Google Cloud
     Console). **Debe ser el mismo** que `GOOGLE_CLIENT_ID` del worker (el worker
     valida que el `aud` del ID token sea ese client id). Además registra el
     **SHA-1** del keystore de firma como un *Android client id* del mismo
     proyecto OAuth.
   - `facebook_app_id`, `facebook_client_token`, `fb_login_protocol_scheme`
     (= `"fb"` + app id) de developers.facebook.com.
4. **Producción worker**: define `GOOGLE_CLIENT_ID` (y opcional `FACEBOOK_APP_ID`)
   como secretos; quita `AUTH_DEV_MOCK`.

> Igual que `fcm/`, este módulo no se puede compilar/ejecutar en esta máquina
> (necesita Android SDK + dispositivo). El código y el cableado están listos
> para Android Studio; solo faltan tus client ids reales.

## Reenviador: lector de notificaciones (NotificationListener)

El módulo `ingest/` captura las notificaciones del SO de las apps que el usuario
permitió y las sube al worker, que decide a qué canales reenviarlas.

```
ingest/
├── build.gradle.kts
└── src/main/
    ├── AndroidManifest.xml                          ← declara el Service + permiso
    └── kotlin/com/yapi/ingest/
        ├── YapiNotificationListenerService.kt        ← captura y POST /ingest
        ├── IngestModule.kt                           ← setSession / abrir Ajustes
        └── Prefs.kt                                   ← sesión compartida (SharedPreferences)
```

Flujo:
1. Al iniciar sesión, `apps/mobile/src/App.tsx` registra el dispositivo y llama a
   `setIngestSession(deviceId, packages)` (`notifListener.ts`), que persiste en el
   nativo el token, la URL del worker, el id del dispositivo y los packages
   permitidos (las apps elegidas en Configuración → Dispositivos).
2. El usuario concede **Acceso a notificaciones** (Configuración → Dispositivos
   muestra un botón que abre Ajustes vía `IngestModule.openNotificationAccessSettings`).
3. `YapiNotificationListenerService.onNotificationPosted` filtra por los packages
   permitidos y hace `POST /ingest` con el Bearer del usuario.
4. El worker enruta: a los canales que enrutan ese dispositivo, apuntan a esa app
   y están dentro de su horario → crea la notificación del canal y dispara push a
   los miembros aceptados.

Registrado en `YapiApp.onCreate`:
`LynxEnv.inst().registerModule("IngestModule", IngestModule.class)`.

> Privacidad: solo se reenvían las apps que el usuario activa explícitamente; el
> resto de notificaciones nunca sale del dispositivo. Como `fcm/` y `auth/`, no
> se compila aquí (requiere Android SDK + dispositivo).

## iOS

Equivalente pendiente: registrar la app iOS en Firebase, `GoogleService-Info.plist`, un
`FcmModule` en Swift (`Messaging.messaging().token`) y `UNUserNotificationCenter` para mostrar.

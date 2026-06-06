plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.yapi.auth"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        // Permite empaquetar el AndroidManifest con las Activities de Facebook.
        buildConfig = false
    }
}

dependencies {
    // Google Sign-In moderno (Credential Manager + Google ID token).
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Facebook Login.
    implementation("com.facebook.android:facebook-login:17.0.0")

    // Corrutinas para el flujo suspendido de Credential Manager.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Lynx: las clases (LynxModule, Callback) las provee el engine en runtime.
    compileOnly("org.lynxsdk.lynx:lynx:3.8.0")
}

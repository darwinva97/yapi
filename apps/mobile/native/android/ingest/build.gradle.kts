plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.yapi.ingest"
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
}

dependencies {
    // Cliente HTTP para subir la notificación al worker (POST /ingest).
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Lynx: las clases (LynxModule, Callback) las provee el engine en runtime.
    compileOnly("org.lynxsdk.lynx:lynx:3.8.0")
}

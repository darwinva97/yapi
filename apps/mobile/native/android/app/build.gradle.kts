plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.yapi.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.yapi.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            pickFirsts += listOf("**/libc++_shared.so")
        }
    }
}

dependencies {
    // Firebase Cloud Messaging
    implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")

    // Lynx engine
    implementation("org.lynxsdk.lynx:lynx:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-jssdk:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-trace:3.8.0")
    implementation("org.lynxsdk.lynx:primjs:3.8.0")
    // lynx-service-image requiere Fresco; nuestra UI no usa imágenes, así que se omite.
    implementation("org.lynxsdk.lynx:lynx-service-log:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-service-http:3.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0") // requerido por lynx-service-http

    // NativeModule FcmModule
    implementation(project(":fcm"))

    // NativeModule SocialAuthModule (Google / Facebook)
    implementation(project(":auth"))

    // NativeModule IngestModule + NotificationListenerService (reenviador)
    implementation(project(":ingest"))
}

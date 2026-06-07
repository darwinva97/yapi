pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "yapi-android"
include(":app")
include(":fcm")
include(":auth")
include(":ingest")
include(":app-native")

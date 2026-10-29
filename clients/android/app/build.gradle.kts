plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.aida0710.kikitori"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.aida0710.kikitori"
        // InputMethodService.switchToPreviousInputMethod() が使えるのは API 28 から
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        // 組み立てのたびに試験用の鍵が変わると入れ直せないので、決まった鍵を使う（中身は Android の既定の試験用の値）
        getByName("debug") {
            providers.environmentVariable("KIKITORI_DEBUG_KEYSTORE").orNull?.let { storeFile = file(it) }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("com.squareup.okhttp3:okhttp:5.5.1")
}

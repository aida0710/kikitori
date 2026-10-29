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
        // 配る版の鍵。tools/build-release-apk.sh が鍵のファイルの場所とパスワードを環境変数で渡す（リポジトリには置かない）
        create("release") {
            providers.environmentVariable("KIKITORI_RELEASE_KEYSTORE").orNull?.let { storeFile = file(it) }
            storeType = "PKCS12"
            storePassword = providers.environmentVariable("KIKITORI_ANDROID_KEYSTORE_PASSWORD").orNull
            keyAlias = providers.environmentVariable("KIKITORI_ANDROID_KEY_ALIAS").orNull
            // PKCS12 の鍵は、鍵のパスワードも鍵のファイルのパスワードと同じ
            keyPassword = providers.environmentVariable("KIKITORI_ANDROID_KEYSTORE_PASSWORD").orNull
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
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

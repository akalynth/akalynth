import org.gradle.api.tasks.testing.Test

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.akalynth.client"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.akalynth.client"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.0-observe"
    }

    buildTypes {
        debug {
            // Local dev: use emulator loopback
            buildConfigField("String", "WS_BASE_URL", "\"ws://10.0.2.2:3000\"")
            buildConfigField("String", "HTTP_BASE_URL", "\"http://10.0.2.2:3000\"")
            buildConfigField("String", "PORTAL_ACCOUNT_URL", "\"http://10.0.2.2:8099/account.html\"")
        }
        create("beta") {
            // Beta server: wss://beta-api.akalynth.com
            initWith(getByName("debug"))
            matchingFallbacks += listOf("debug")
            buildConfigField("String", "WS_BASE_URL", "\"wss://beta-api.akalynth.com\"")
            buildConfigField("String", "HTTP_BASE_URL", "\"https://beta-api.akalynth.com\"")
            buildConfigField("String", "PORTAL_ACCOUNT_URL", "\"https://beta.akalynth.com/account.html\"")
        }
        create("staging") {
            // Staging server: wss://staging-api.akalynth.com
            initWith(getByName("debug"))
            matchingFallbacks += listOf("debug")
            buildConfigField("String", "WS_BASE_URL", "\"wss://staging-api.akalynth.com\"")
            buildConfigField("String", "HTTP_BASE_URL", "\"https://staging-api.akalynth.com\"")
            buildConfigField("String", "PORTAL_ACCOUNT_URL", "\"https://staging.akalynth.com/account.html\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "WS_BASE_URL", "\"wss://api.akalynth.com\"")
            buildConfigField("String", "HTTP_BASE_URL", "\"https://api.akalynth.com\"")
            buildConfigField("String", "PORTAL_ACCOUNT_URL", "\"https://akalynth.com/account.html\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.appcompat)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.foundation)

    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.navigation.compose)

    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.datastore.preferences)
    implementation(libs.constraintlayout.compose)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.test.core)

    androidTestImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.kotlinx.coroutines.test)
}

tasks.withType<Test>().configureEach {
    if (name in setOf("testBetaUnitTest", "testStagingUnitTest", "testReleaseUnitTest")) {
        // These host Compose tests require ui-test-manifest, which is kept debug-only so
        // ComponentActivity is not added to beta, staging, or release APK manifests.
        exclude(
            "com/akalynth/client/ui/components/ActionButtonsTest.class",
            "com/akalynth/client/ui/components/TemChallengeDialogTest.class",
            "com/akalynth/client/ui/components/chronicle/ChronicleSheetTest.class",
            "com/akalynth/client/ui/regression/LoginScreenEntryParityTest.class"
        )
    }
}

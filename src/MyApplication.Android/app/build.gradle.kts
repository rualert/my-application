import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    // Нужен Room: реализации DAO он генерирует при сборке.
    alias(libs.plugins.ksp)
}

/**
 * Настройки сборки читаются из `local.properties` (в git не попадает), иначе из
 * свойств проекта — то есть из `-P` в командной строке или из `gradle.properties`,
 * где лежат значения по умолчанию. Пустое значение считается незаданным, поэтому
 * пустая заглушка в `gradle.properties` не перебивает реальное значение.
 */
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use(::load)
    }
}

fun buildSetting(name: String): String = sequenceOf(
    localProperties.getProperty(name),
    project.findProperty(name) as String?,
).firstOrNull { !it.isNullOrBlank() }.orEmpty()

android {
    namespace = "io.github.rualert.mynotesapp"

    // Компилируемся против API 37: этого требуют нынешние AndroidX и Compose.
    // targetSdk отстаёт намеренно — он включает новое поведение системы в
    // рантайме, и поднимать его нужно осознанно, а не заодно с compileSdk.
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.rualert.mynotesapp"
        minSdk = 26
        targetSdk = 36
        // Версия тоже приходит настройкой сборки: релизный workflow берёт имя
        // версии из тега, а versionCode — из номера запуска, чтобы каждая
        // следующая сборка ставилась поверх предыдущей (Android не даёт
        // обновить APK меньшим versionCode).
        versionCode = buildSetting("myNotesApp.versionCode").toIntOrNull() ?: 1
        versionName = buildSetting("myNotesApp.versionName").ifEmpty { "1.0" }

        buildConfigField("String", "API_BASE_URL", "\"${buildSetting("myNotesApp.apiBaseUrl")}\"")
        buildConfigField(
            "String",
            "GOOGLE_SERVER_CLIENT_ID",
            "\"${buildSetting("myNotesApp.googleServerClientId")}\"",
        )
    }

    // Релизный ключ задаётся теми же настройками сборки, что и всё остальное:
    // в CI — секретами репозитория (путь указывает на файл, восстановленный из
    // ANDROID_KEYSTORE_BASE64), локально — через local.properties. Если ключа
    // нет, конфигурация не создаётся вовсе и assembleRelease даёт неподписанный
    // APK: собрать релиз без ключа можно, а раздать — нет.
    //
    // Отпечаток SHA-1 этого ключа должен быть зарегистрирован в Android-клиенте
    // OAuth проекта Google Cloud, иначе системный диалог входа откажется выдать
    // токен (см. README).
    val releaseKeystore = buildSetting("myNotesApp.releaseKeystore")

    signingConfigs {
        if (releaseKeystore.isNotEmpty()) {
            create("release") {
                storeFile = file(releaseKeystore)
                storePassword = buildSetting("myNotesApp.releaseKeystorePassword")
                keyAlias = buildSetting("myNotesApp.releaseKeyAlias")
                keyPassword = buildSetting("myNotesApp.releaseKeyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")

            // Сжатие и обфускация пока выключены: у Retrofit и kotlinx.serialization
            // свои keep-правила, и включать R8 стоит вместе с релизной подписью,
            // проверив собранный APK на устройстве, а не вслепую.
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    // Kotlin отдельно настраивать не нужно: со встроенной поддержкой из AGP 9
    // jvmTarget по умолчанию равен targetCompatibility.
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Robolectric поднимает настоящий Android-рантайм, и ресурсы ему нужны.
    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.google.identity.googleid)

    implementation(libs.androidx.datastore.preferences)

    // Хранилище заметок на устройстве и отправка изменений в фоне.
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.work.runtime)

    // Режим просмотра отрисовывает текст заметки как Markdown — ровно как
    // react-markdown в веб-интерфейсе.
    implementation(libs.markdown.renderer.m3)

    debugImplementation(libs.androidx.compose.ui.tooling)

    // Тесты подменяют только сетевую границу (MockWebServer): Retrofit,
    // репозиторий и ViewModel в них настоящие — как MSW в веб-интерфейсе.
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    // Хранилище на устройстве — настоящий SQLite, подменять его нечем:
    // тестам, которым нужна база, обычной JVM мало.
    testImplementation(libs.robolectric)
}

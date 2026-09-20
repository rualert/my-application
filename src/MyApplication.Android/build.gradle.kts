// Версии плагинов объявлены в gradle/libs.versions.toml и применяются в app/build.gradle.kts.
//
// Плагина org.jetbrains.kotlin.android здесь нет намеренно: начиная с AGP 9
// поддержка Kotlin встроена в сам com.android.application, и применение
// отдельного плагина — ошибка сборки (https://kotl.in/gradle/agp-built-in-kotlin).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

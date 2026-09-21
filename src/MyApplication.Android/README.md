# MyApplication.Android

Клиент для Android к тому же API, с которым работает веб-интерфейс. Требования
к поведению — в [спецификации](../../docs/docs/notes/android.md), она же
источник правды: сначала меняется документ, потом код.

Отдельный Gradle-проект, в `MyApplication.sln` он не входит — как и
`MyApplication.Web.UI`.

## Что нужно для сборки

- JDK 17 или новее (проверено на Microsoft OpenJDK 21). Gradle берёт его из
  `JAVA_HOME`.
- Android SDK с платформой API 37. Проще всего — установить Android Studio и
  один раз пройти мастер первого запуска: он скачает SDK в
  `%LOCALAPPDATA%\Android\Sdk`. Gradle находит SDK по переменной `ANDROID_HOME`
  либо по файлу `local.properties` (`sdk.dir=...`).
- Сам Gradle ставить не нужно — его скачивает `gradlew`.

## Настройки сборки

Значения по умолчанию лежат в `gradle.properties`, переопределяются в
`local.properties` (в git не попадает) или ключом `-P`:

| Свойство | Смысл |
|---|---|
| `myNotesApp.apiBaseUrl` | Адрес API. По умолчанию — развёрнутый экземпляр в Railway |
| `myNotesApp.googleServerClientId` | Идентификатор **веб-клиента** Google OAuth — тот же, что у веб-интерфейса (`VITE_GOOGLE_CLIENT_ID`). В git не хранится |
| `myNotesApp.versionName` / `myNotesApp.versionCode` | Версия приложения. Локально — `1.0`/`1`, при выпуске подставляются из тега и номера запуска workflow |
| `myNotesApp.releaseKeystore` и три пароля к нему | Ключ релизной подписи, см. «[Выпуск APK](#выпуск-apk)». Нужен только для `assembleRelease` |

Пример `local.properties`:

```properties
sdk.dir=C\:\\Users\\<имя>\\AppData\\Local\\Android\\Sdk
myNotesApp.googleServerClientId=<идентификатор веб-клиента>.apps.googleusercontent.com
```

### Вход через Google

Сервер проверяет `aud` полученного ID token по своему `Google:ClientId`, то есть
по идентификатору веб-клиента, — поэтому в API для Android менять нечего.

Но в том же проекте Google Cloud (`mynotesapp-509010`) должен существовать
OAuth-клиент **типа Android** с идентификатором пакета
`io.github.rualert.mynotesapp` и отпечатком SHA-1 того ключа, которым подписан
APK: по нему Google проверяет, что токен просит именно это приложение. Отпечаток
отладочного ключа:

```powershell
keytool -list -v -alias androiddebugkey -keystore $env:USERPROFILE\.android\debug.keystore -storepass android -keypass android
```

Для релизного ключа — то же самое с его keystore. Каждый ключ нужно добавить в
Google Cloud отдельно.

## Сборка и установка

```powershell
.\gradlew.bat assembleDebug        # APK: app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat installDebug         # собрать и поставить на подключённое устройство
.\gradlew.bat testDebugUnitTest    # тесты (без устройства и эмулятора)
```

APK ставится на телефон вручную, из неизвестных источников: в магазине
приложение не публикуется.

## Выпуск APK

Готовый APK лежит на [странице релизов](https://github.com/rualert/my-application/releases):
скачать файл прямо на телефон, открыть, разрешить установку из неизвестного
источника. Ссылка открывается без входа в GitHub — артефакт сборки из workflow
`android` для этого не годится (отдаётся zip-архивом и только авторизованным,
а главное — подписан случайным отладочным ключом, с которым вход через Google
не работает).

Выпуск делает workflow `android-release` по пушу тега. Префикс `android-`
обязателен: репозиторий общий для API, веб-интерфейса и этого клиента, и по
тегу должно быть видно, что именно выпускается.

```powershell
git tag android-v1.0.0
git push origin android-v1.0.0
```

Он прогоняет тесты, собирает подписанный релизный APK (`versionName` — из тега,
`versionCode` — из номера запуска, чтобы новая сборка вставала поверх прежней)
и создаёт релиз с этим файлом.

### Разовая настройка

1. Создать релизный keystore и **сохранить его** — потерять его значит
   потерять возможность обновлять уже установленное приложение:

   ```powershell
   keytool -genkeypair -v -keystore release.keystore -alias mynotesapp `
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Добавить его отпечаток SHA-1 в OAuth-клиент типа Android проекта Google
   Cloud (см. «[Вход через Google](#вход-через-google)») — иначе в выпущенном
   APK вход не заработает. Отпечаток:

   ```powershell
   keytool -list -v -alias mynotesapp -keystore release.keystore
   ```

3. Завести секреты репозитория (**Settings → Secrets and variables → Actions**),
   кроме уже существующего `GOOGLE_CLIENT_ID`:

   | Секрет | Значение |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | Сам keystore в base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) \| Set-Clipboard` |
   | `ANDROID_KEYSTORE_PASSWORD` | Пароль хранилища |
   | `ANDROID_KEY_ALIAS` | Псевдоним ключа (`mynotesapp` в примере выше) |
   | `ANDROID_KEY_PASSWORD` | Пароль ключа |

Собрать подписанный релиз локально можно теми же настройками:

```powershell
.\gradlew.bat assembleRelease -PmyNotesApp.releaseKeystore=<путь>\release.keystore `
  -PmyNotesApp.releaseKeystorePassword=<пароль> `
  -PmyNotesApp.releaseKeyAlias=mynotesapp -PmyNotesApp.releaseKeyPassword=<пароль>
```

Без этих настроек `assembleRelease` тоже проходит, но даёт неподписанный APK
(`app-release-unsigned.apk`), который не установится.

## Эмулятор

Нужен образ **с Google Play** (`google_apis_playstore`): без сервисов Google
системный диалог входа не работает, а он и есть вход в приложение.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$cli = "$env:ANDROID_HOME\cmdline-tools\latest\bin\android.exe"

& $cli emulator create --list-profiles      # доступные профили устройств
& $cli emulator create medium_phone         # создать AVD (скачает образ сам)
& $cli emulator start medium_phone          # вернётся, когда устройство готово

& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n io.github.rualert.mynotesapp/.MainActivity
```

Грабли этого набора инструментов, чтобы не разбираться заново:

- `sdkmanager` объявлен устаревшим и перенаправляет на `android sdk`, но
  **молча не понимает старый формат имён пакетов через точку с запятой**
  (`system-images;android-37.0;...`) — новый CLI ждёт слэши
  (`system-images/android-37.0/google_apis_playstore/x86_64`) и на старый формат
  отвечает «Package not found» для каждого куска имени.
- `android sdk install` и `android emulator create` **завершаются с кодом 9**
  (`0xC0000409`) даже когда всё скачалось и установилось: CLI падает при
  завершении. Судить об успехе нужно по файлам в `system-images`, а не по коду
  возврата.
- `android emulator create` выбирает образ сам и может скачать свой, даже если
  подходящий уже установлен, — пара гигабайт трафика на ровном месте.
- Ускорение проверяется отдельно: `emulator\emulator.exe -accel-check`
  (на этой машине — WHPX).

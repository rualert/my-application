package io.github.rualert.mynotesapp

import android.content.Context
import io.github.rualert.mynotesapp.data.api.AuthApi
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.auth.AuthInterceptor
import io.github.rualert.mynotesapp.data.auth.AuthRepository
import io.github.rualert.mynotesapp.data.auth.CookieStorage
import io.github.rualert.mynotesapp.data.auth.SessionCookieJar
import io.github.rualert.mynotesapp.data.auth.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.create
import java.time.Duration

/**
 * Собирает зависимости приложения вручную, без контейнера внедрения: граф здесь
 * маленький и ровно один, а библиотека вроде Hilt добавила бы в сборку
 * обработку аннотаций ради десятка объектов.
 */
class AppContainer(context: Context) {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/') + "/"

    private val tokens = TokenStore()

    private val cookieJar = SessionCookieJar(
        storage = CookieStorage(context),
        baseUrl = baseUrl.toHttpUrl(),
        scope = applicationScope,
    )

    private val json = Json { ignoreUnknownKeys = true }

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            // Ограничение на запрос целиком, а не только на соединение и чтение:
            // на мобильной сети запрос может не упасть, а тянуться десятки секунд,
            // и всё это время пользователь смотрит на индикатор загрузки.
            .callTimeout(Duration.ofSeconds(15))
            .cookieJar(cookieJar)
            // Лямбда обращается к authRepository в момент вызова, а не при
            // сборке клиента: репозиторий сам создаётся поверх этого клиента.
            .addInterceptor(AuthInterceptor(tokens) { staleToken -> authRepository.refreshSession(staleToken) })
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
                }
            }
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(httpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    private val authApi: AuthApi by lazy { retrofit.create() }

    val notesApi: NotesApi by lazy { retrofit.create() }

    val authRepository: AuthRepository by lazy { AuthRepository(authApi, tokens, cookieJar) }
}

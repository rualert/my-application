package io.github.rualert.mynotesapp.data.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

/**
 * Подставляет `Authorization: Bearer` и один раз повторяет запрос, получивший
 * `401`, обновив перед этим сессию — тот же приём, что в `api/client.ts`
 * веб-интерфейса.
 *
 * Запросы к путям `/Auth` пропускаются нетронутыми: это сама точка входа в сессию,
 * токена она не требует, и повторять её через обновление сессии значило бы
 * зациклиться на `/Auth/refresh`.
 */
class AuthInterceptor(
    private val tokens: TokenStore,
    private val refreshSession: suspend (staleToken: String?) -> Boolean,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.url.encodedPath.startsWith(AUTH_PATH_PREFIX, ignoreCase = true)) {
            return chain.proceed(request)
        }

        val usedToken = tokens.accessToken
        val response = chain.proceed(request.withBearer(usedToken))
        if (response.code != HTTP_UNAUTHORIZED) {
            return response
        }

        response.close()
        val refreshed = runBlocking { refreshSession(usedToken) }
        if (!refreshed) {
            return unauthorized(request)
        }

        return chain.proceed(request.withBearer(tokens.accessToken))
    }

    private fun Request.withBearer(token: String?): Request =
        if (token == null) this else newBuilder().header("Authorization", "Bearer $token").build()

    private fun unauthorized(request: Request): Response = Response.Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(HTTP_UNAUTHORIZED)
        .message("Unauthorized")
        .body("".toResponseBody(null))
        .build()

    private companion object {
        const val AUTH_PATH_PREFIX = "/Auth"
        const val HTTP_UNAUTHORIZED = 401
    }
}

package io.github.rualert.mynotesapp.data.api

import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Точка входа в сессию. Refresh-token в теле не ходит — он живёт в cookie,
 * которую хранит [io.github.rualert.mynotesapp.data.auth.SessionCookieJar].
 */
interface AuthApi {

    @POST("Auth/google")
    suspend fun loginWithGoogle(@Body request: GoogleLoginRequest): AuthResponse

    @POST("Auth/refresh")
    suspend fun refresh(): AuthResponse

    @POST("Auth/logout")
    suspend fun logout()
}

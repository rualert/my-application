package io.github.rualert.mynotesapp.data.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Заметки текущего пользователя. Все запросы требуют заголовок
 * `Authorization: Bearer` — его подставляет
 * [io.github.rualert.mynotesapp.data.auth.AuthInterceptor].
 */
interface NotesApi {

    @GET("Notes")
    suspend fun list(
        @Query("from") from: Int,
        @Query("count") count: Int,
    ): List<NoteSummaryResponse>

    @GET("Notes/search")
    suspend fun search(@Query("query") query: String): List<NoteSearchResultResponse>

    @GET("Notes/{id}")
    suspend fun byId(@Path("id") id: String): NoteResponse

    @POST("Notes")
    suspend fun create(@Body request: CreateNoteRequest): NoteResponse

    @PUT("Notes/{id}")
    suspend fun update(@Path("id") id: String, @Body request: UpdateNoteRequest): NoteResponse

    @DELETE("Notes/{id}")
    suspend fun delete(@Path("id") id: String)
}

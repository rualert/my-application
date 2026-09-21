package io.github.rualert.mynotesapp.data.api

import kotlinx.serialization.Serializable

/**
 * Тела запросов и ответов API — зеркало `MyApplication.Api/Models`
 * (см. docs/docs/notes/api-contract и docs/docs/auth/api-contract).
 * Имена полей совпадают с camelCase, который отдаёт System.Text.Json.
 *
 * Моменты времени оставлены строками: приводить их к типу времени — дело
 * доменной модели, а не транспорта.
 */
@Serializable
data class GoogleLoginRequest(val idToken: String)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val expiresAt: String,
    val userName: String,
)

@Serializable
data class NoteResponse(
    val id: String,
    val title: String?,
    val text: String,
    val version: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class NoteSummaryResponse(
    val id: String,
    val title: String?,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class CreateNoteRequest(val title: String?, val text: String)

@Serializable
data class UpdateNoteRequest(val title: String?, val text: String, val version: Int)

@Serializable
data class HighlightedSegmentResponse(val text: String, val match: Boolean)

@Serializable
data class NoteSearchResultResponse(
    val id: String,
    val title: List<HighlightedSegmentResponse>,
    val snippet: List<HighlightedSegmentResponse>,
)

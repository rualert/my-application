namespace MyApplication.Api.Models;

/// <summary>
///     Заметка целиком, включая текст. <paramref name="Version"/> — текущая версия
///     заметки; её клиент присылает обратно в <see cref="UpdateNoteRequest"/>.
/// </summary>
public record NoteResponse(Guid Id, string? Title, string Text, int Version, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

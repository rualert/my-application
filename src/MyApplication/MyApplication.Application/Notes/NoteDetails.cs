namespace MyApplication.Application.Notes;

/// <summary>
///     Заметка целиком, включая текст. <paramref name="Title"/> — <c>null</c>, если у заметки нет заголовка.
/// </summary>
public record NoteDetails(Guid Id, string? Title, string Text, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

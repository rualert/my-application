namespace MyApplication.Application.Notes;

/// <summary>
///     Заметка целиком, включая текст. <paramref name="Title"/> — <c>null</c>, если у заметки нет заголовка.
///     <paramref name="Version"/> — текущая версия заметки, её нужно передать в
///     <see cref="INoteService.UpdateAsync"/>, чтобы обновление не затёрло чужие правки.
/// </summary>
public record NoteDetails(Guid Id, string? Title, string Text, int Version, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

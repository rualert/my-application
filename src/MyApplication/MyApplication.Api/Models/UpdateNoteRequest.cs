namespace MyApplication.Api.Models;

/// <summary>
///     Тело запроса на обновление заголовка и текста заметки.
///     <paramref name="Title"/> необязателен: отсутствие, <c>null</c>, пустая строка или одни пробелы
///     означают «без заголовка».
///     <paramref name="Version"/> — версия заметки, от которой клиент отталкивался при
///     редактировании (пришла в <see cref="NoteResponse"/>): если заметку успели изменить
///     где-то ещё, обновление отклоняется с 409 вместо молчаливой перезаписи.
/// </summary>
public record UpdateNoteRequest(string? Title, string Text, int Version);

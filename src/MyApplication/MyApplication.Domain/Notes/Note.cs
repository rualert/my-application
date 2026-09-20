using System.Text;

namespace MyApplication.Domain.Notes;

/// <summary>
///     Заметка — заголовок и текст произвольного объёма.
/// </summary>
public class Note
{
    public const int MaxTitleLength = 1024;
    public const int MaxTextBytes = 1024 * 1024;

    public Guid Id { get; }
    public Guid UserId { get; }
    /// <summary>
    ///     Заголовок заметки; <c>null</c>, если заголовок не задан.
    /// </summary>
    public string? Title { get; private set; }
    public string Text { get; private set; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private Note(Guid id, Guid userId, string? title, string text, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        Id = id;
        UserId = userId;
        Title = title;
        Text = text;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
    }

    /// <summary>
    ///     Создаёт новую заметку с указанными владельцем, заголовком и текстом.
    ///     Пустой заголовок (<c>null</c>, пустая строка или одни пробелы) означает «без заголовка»
    ///     и хранится как <c>null</c>.
    /// </summary>
    /// <returns>Новая заметка с сгенерированным идентификатором.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="text"/> равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">
    ///     Заголовок длиннее <see cref="MaxTitleLength"/> символов,
    ///     либо текст (в UTF-8) занимает больше <see cref="MaxTextBytes"/> байт.
    /// </exception>
    public static Note Create(Guid userId, string? title, string text)
    {
        var normalizedTitle = NormalizeTitle(title);
        ValidateText(text);

        var now = DateTimeOffset.UtcNow;
        return new Note(Guid.NewGuid(), userId, normalizedTitle, text, now, now);
    }

    /// <summary>
    ///     Обновляет заголовок и текст заметки, проставляя новую дату изменения.
    ///     Пустой заголовок (<c>null</c>, пустая строка или одни пробелы) означает «без заголовка»
    ///     и хранится как <c>null</c>.
    /// </summary>
    /// <exception cref="ArgumentNullException"><paramref name="text"/> равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">
    ///     Заголовок длиннее <see cref="MaxTitleLength"/> символов,
    ///     либо текст (в UTF-8) занимает больше <see cref="MaxTextBytes"/> байт.
    /// </exception>
    public void Update(string? title, string text)
    {
        var normalizedTitle = NormalizeTitle(title);
        ValidateText(text);

        Title = normalizedTitle;
        Text = text;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static string? NormalizeTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }

        if (title.Length > MaxTitleLength)
        {
            throw new NoteValidationException($"Заголовок заметки не может быть длиннее {MaxTitleLength} символов.");
        }

        return title;
    }

    private static void ValidateText(string text)
    {
        ArgumentNullException.ThrowIfNull(text);

        var byteCount = Encoding.UTF8.GetByteCount(text);
        if (byteCount > MaxTextBytes)
        {
            throw new NoteValidationException($"Текст заметки не может превышать {MaxTextBytes} байт (сейчас {byteCount}).");
        }
    }
}

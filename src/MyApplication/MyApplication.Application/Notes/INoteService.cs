namespace MyApplication.Application.Notes;

/// <summary>
///     Use case'ы для работы с заметками.
/// </summary>
public interface INoteService
{
    /// <summary>
    ///     Создаёт новую заметку.
    /// </summary>
    Task<NoteDetails> CreateAsync(string title, string text, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает страницу заметок (без текста), отсортированных от новых
    ///     к старым: пропускает первые <paramref name="from"/> заметок и
    ///     возвращает не более <paramref name="count"/> следующих.
    /// </summary>
    /// <exception cref="ApplicationException">
    ///     <paramref name="from"/> отрицательный, либо <paramref name="count"/> не положительный.
    /// </exception>
    Task<IReadOnlyList<NoteSummary>> GetAllAsync(int from, int count, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    Task<NoteDetails> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    ///     Обновляет заголовок и текст существующей заметки.
    /// </summary>
    Task<NoteDetails> UpdateAsync(Guid id, string title, string text, CancellationToken cancellationToken);

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

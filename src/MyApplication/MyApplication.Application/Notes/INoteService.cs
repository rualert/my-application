namespace MyApplication.Application.Notes;

/// <summary>
///     Use case'ы для работы с заметками. Каждая операция скоупится по
///     вызывающему пользователю (<c>callerUserId</c>) — заметки приватны.
/// </summary>
public interface INoteService
{
    /// <summary>
    ///     Создаёт новую заметку от имени <paramref name="callerUserId"/>.
    /// </summary>
    Task<NoteDetails> CreateAsync(Guid callerUserId, string title, string text, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает страницу заметок пользователя <paramref name="callerUserId"/>
    ///     (без текста), отсортированных от новых к старым: пропускает первые
    ///     <paramref name="from"/> заметок и возвращает не более
    ///     <paramref name="count"/> следующих.
    /// </summary>
    /// <exception cref="ApplicationException">
    ///     <paramref name="from"/> отрицательный, либо <paramref name="count"/> не положительный.
    /// </exception>
    Task<IReadOnlyList<NoteSummary>> GetAllAsync(Guid callerUserId, int from, int count, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    Task<NoteDetails> GetByIdAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken);

    /// <summary>
    ///     Обновляет заголовок и текст существующей заметки.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    Task<NoteDetails> UpdateAsync(Guid callerUserId, Guid id, string title, string text, CancellationToken cancellationToken);

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    Task DeleteAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken);
}

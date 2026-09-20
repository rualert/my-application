namespace MyApplication.Application.Notes;

/// <summary>
///     Use case'ы для работы с заметками. Каждая операция скоупится по
///     вызывающему пользователю (<c>callerUserId</c>) — заметки приватны.
/// </summary>
public interface INoteService
{
    /// <summary>
    ///     Создаёт новую заметку от имени <paramref name="callerUserId"/>.
    ///     Пустой <paramref name="title"/> (<c>null</c>, пустая строка, одни пробелы) означает
    ///     «без заголовка» — у созданной заметки <c>Title</c> будет <c>null</c>.
    /// </summary>
    Task<NoteDetails> CreateAsync(Guid callerUserId, string? title, string text, CancellationToken cancellationToken);

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
    ///     Обновляет заголовок и текст существующей заметки. Пустой <paramref name="title"/>
    ///     (<c>null</c>, пустая строка, одни пробелы) означает «без заголовка» — <c>Title</c>
    ///     заметки станет <c>null</c>.
    ///     <paramref name="expectedVersion"/> — версия заметки, от которой отталкивался
    ///     вызывающий: она должна совпадать с текущей, иначе заметку изменили где-то ещё
    ///     и обновление отклоняется, чтобы не затереть те правки.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    /// <exception cref="NoteConflictException">
    ///     Текущая версия заметки отличается от <paramref name="expectedVersion"/>.
    /// </exception>
    Task<NoteDetails> UpdateAsync(Guid callerUserId, Guid id, string? title, string text, int expectedVersion, CancellationToken cancellationToken);

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    Task DeleteAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken);
}

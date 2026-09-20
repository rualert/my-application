namespace MyApplication.Application.Notes;

/// <summary>
///     Заметку изменили с той версии, от которой отталкивался вызывающий
///     (например, её отредактировали в другой вкладке) — обновление отклонено,
///     сохранённая заметка не изменилась.
/// </summary>
public class NoteConflictException : ApplicationException
{
    public NoteConflictException(Guid id, int expectedVersion, int actualVersion)
        : base($"Заметка с идентификатором {id} была изменена: ожидалась версия {expectedVersion}, текущая — {actualVersion}.")
    {
    }

    public NoteConflictException(Guid id)
        : base($"Заметка с идентификатором {id} была изменена параллельно этому обновлению.")
    {
    }
}

namespace MyApplication.Application.Notes;

/// <summary>
///     Заметка с указанным идентификатором не найдена.
/// </summary>
public class NoteNotFoundException : ApplicationException
{
    public NoteNotFoundException(Guid id) : base($"Заметка с идентификатором {id} не найдена.")
    {
    }
}

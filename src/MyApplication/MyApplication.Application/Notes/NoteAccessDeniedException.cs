namespace MyApplication.Application.Notes;

/// <summary>
///     Заметка с указанным идентификатором существует, но принадлежит другому пользователю.
/// </summary>
public class NoteAccessDeniedException : ApplicationException
{
    public NoteAccessDeniedException(Guid id) : base($"Нет доступа к заметке с идентификатором {id}.")
    {
    }
}

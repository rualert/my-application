namespace MyApplication.Domain.Notes;

/// <summary>
///     Нарушение бизнес-правил заметки (заголовок или текст не проходят валидацию).
/// </summary>
public class NoteValidationException : DomainException
{
    public NoteValidationException(string message) : base(message)
    {
    }
}

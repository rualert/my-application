namespace MyApplication.Domain;

/// <summary>
///     Базовый класс для всех доменных исключений — нарушений бизнес-правил
///     и инвариантов. Общий предок для исключений слоя Domain (например,
///     <see cref="Notes.NoteValidationException"/>) и слоя Application
///     (<c>MyApplication.Application.ApplicationException</c>).
/// </summary>
public abstract class DomainException : Exception
{
    protected DomainException(string message) : base(message)
    {
    }
}

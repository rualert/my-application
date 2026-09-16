using MyApplication.Domain;

namespace MyApplication.Application;

/// <summary>
///     Базовый класс для всех исключений слоя Application. Наследуется от
///     <see cref="DomainException"/>, поэтому попадает под ту же глобальную
///     обработку (маппинг на 400). Это отдельный тип, не имеющий отношения
///     к <see cref="System.ApplicationException"/> из BCL.
/// </summary>
public abstract class ApplicationException : DomainException
{
    protected ApplicationException(string message) : base(message)
    {
    }
}

using MyApplication.Domain;

namespace MyApplication.Application;

/// <summary>
///     Базовый класс для всех исключений слоя Application. Наследуется от
///     <see cref="DomainException"/>, поэтому попадает под ту же глобальную
///     обработку (маппинг на 400). Это отдельный тип, не имеющий отношения
///     к <see cref="System.ApplicationException"/> из BCL.
///
///     Используется напрямую для ошибок, которые не планируется различать
///     по типу (обрабатываются общим глобальным маппингом на 400) — заводить
///     под них отдельный подкласс не нужно. Подкласс оправдан только когда
///     его действительно требуется ловить/различать отдельно (например,
///     <see cref="Notes.NoteNotFoundException"/>).
/// </summary>
public class ApplicationException : DomainException
{
    public ApplicationException(string message) : base(message)
    {
    }
}

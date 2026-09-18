namespace MyApplication.Domain.Auth;

/// <summary>
///     Нарушение бизнес-правил пользователя (пустой email/имя/идентификатор Google).
/// </summary>
public class UserValidationException : DomainException
{
    public UserValidationException(string message) : base(message)
    {
    }
}

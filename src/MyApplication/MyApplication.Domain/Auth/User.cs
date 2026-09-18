namespace MyApplication.Domain.Auth;

/// <summary>
///     Пользователь, аутентифицированный через Google.
/// </summary>
public class User
{
    public Guid Id { get; }
    public string GoogleSubjectId { get; }
    public string Email { get; private set; }
    public string Name { get; private set; }
    public DateTimeOffset CreatedAt { get; }

    private User(Guid id, string googleSubjectId, string email, string name, DateTimeOffset createdAt)
    {
        Id = id;
        GoogleSubjectId = googleSubjectId;
        Email = email;
        Name = name;
        CreatedAt = createdAt;
    }

    /// <summary>
    ///     Создаёт нового пользователя по данным профиля Google.
    /// </summary>
    /// <returns>Новый пользователь с сгенерированным идентификатором.</returns>
    /// <exception cref="UserValidationException">
    ///     <paramref name="googleSubjectId"/>, <paramref name="email"/> или <paramref name="name"/> пусты.
    /// </exception>
    public static User Create(string googleSubjectId, string email, string name)
    {
        if (string.IsNullOrWhiteSpace(googleSubjectId))
        {
            throw new UserValidationException("Идентификатор пользователя Google не может быть пустым.");
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new UserValidationException("Email пользователя не может быть пустым.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new UserValidationException("Имя пользователя не может быть пустым.");
        }

        return new User(Guid.NewGuid(), googleSubjectId, email, name, DateTimeOffset.UtcNow);
    }

    /// <summary>
    ///     Обновляет email и имя пользователя данными из свежего профиля Google.
    /// </summary>
    public void UpdateProfile(string email, string name)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new UserValidationException("Email пользователя не может быть пустым.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new UserValidationException("Имя пользователя не может быть пустым.");
        }

        Email = email;
        Name = name;
    }
}

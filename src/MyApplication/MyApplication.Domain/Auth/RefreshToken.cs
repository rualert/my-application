namespace MyApplication.Domain.Auth;

/// <summary>
///     Refresh-токен, выданный пользователю для получения новой пары токенов
///     без повторного входа через Google. Хранится в виде хэша (<see cref="TokenHash"/>),
///     не сырого значения.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; }
    public Guid UserId { get; }
    public string TokenHash { get; }
    public DateTimeOffset CreatedAt { get; }
    public DateTimeOffset ExpiresAt { get; }
    public DateTimeOffset? RevokedAt { get; private set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;

    private RefreshToken(Guid id, Guid userId, string tokenHash, DateTimeOffset createdAt, DateTimeOffset expiresAt)
    {
        Id = id;
        UserId = userId;
        TokenHash = tokenHash;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
    }

    /// <summary>
    ///     Выдаёт новый refresh-токен для пользователя.
    /// </summary>
    public static RefreshToken Issue(Guid userId, string tokenHash, DateTimeOffset expiresAt)
    {
        return new RefreshToken(Guid.NewGuid(), userId, tokenHash, DateTimeOffset.UtcNow, expiresAt);
    }

    /// <summary>
    ///     Отзывает токен (используется при логауте и при ротации на новый токен).
    ///     Повторный вызов не имеет эффекта.
    /// </summary>
    public void Revoke()
    {
        RevokedAt ??= DateTimeOffset.UtcNow;
    }
}

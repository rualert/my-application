using MyApplication.Domain.Auth;

namespace MyApplication.Application.Auth;

/// <summary>
///     Выданный access token и момент истечения его срока действия.
/// </summary>
public record AccessToken(string Value, DateTimeOffset ExpiresAt);

/// <summary>
///     Порт для выпуска подписанных access token'ов — реализуется в слое Infrastructure.
/// </summary>
public interface IJwtTokenGenerator
{
    /// <summary>
    ///     Выпускает новый access token для пользователя.
    /// </summary>
    AccessToken GenerateAccessToken(User user);
}

namespace MyApplication.Application.Auth;

/// <summary>
///     Профиль пользователя, извлечённый из проверенного Google ID token.
/// </summary>
public record GoogleUserInfo(string Subject, string Email, string Name);

/// <summary>
///     Порт для проверки Google ID token — реализуется в слое Infrastructure
///     поверх клиента Google. Единственный порт Application-слоя, который в
///     тестах допустимо подменять фейком: он оборачивает внешний сторонний
///     сервис (серверы Google), а не нашу собственную инфраструктуру.
/// </summary>
public interface IGoogleIdTokenValidator
{
    /// <summary>
    ///     Проверяет подпись, срок действия и audience переданного Google ID token.
    /// </summary>
    /// <returns>Профиль пользователя из токена.</returns>
    /// <exception cref="InvalidGoogleTokenException">Токен невалиден, просрочен или выдан не для этого приложения.</exception>
    Task<GoogleUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken);
}

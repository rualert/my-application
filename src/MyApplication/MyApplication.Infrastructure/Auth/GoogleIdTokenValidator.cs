using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using MyApplication.Application.Auth;

namespace MyApplication.Infrastructure.Auth;

public class GoogleIdTokenValidator : IGoogleIdTokenValidator
{
    private readonly string _clientId;

    /// <summary>
    ///     Создаёт валидатор, проверяющий, что токен выдан для клиента с идентификатором
    ///     из конфигурации <c>Google:ClientId</c>.
    /// </summary>
    public GoogleIdTokenValidator(IConfiguration configuration)
    {
        _clientId = configuration["Google:ClientId"]
                    ?? throw new InvalidOperationException("Не задан Google:ClientId в конфигурации.");
    }

    /// <summary>
    ///     Проверяет подпись, срок действия и audience переданного Google ID token.
    /// </summary>
    /// <returns>Профиль пользователя из токена.</returns>
    /// <exception cref="InvalidGoogleTokenException">Токен невалиден, просрочен или выдан не для этого приложения.</exception>
    public async Task<GoogleUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_clientId],
            });

            return new GoogleUserInfo(payload.Subject, payload.Email, payload.Name);
        }
        catch (InvalidJwtException)
        {
            throw new InvalidGoogleTokenException();
        }
    }
}

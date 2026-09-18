namespace MyApplication.Api.Models.Auth;

/// <summary>
///     Тело запроса на вход через Google.
/// </summary>
public record GoogleLoginRequest(string IdToken);

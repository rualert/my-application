namespace MyApplication.Application.Auth;

/// <summary>
///     Переданный Google ID token невалиден, просрочен или выдан не для этого приложения.
/// </summary>
public class InvalidGoogleTokenException : ApplicationException
{
    public InvalidGoogleTokenException() : base("Токен Google недействителен.")
    {
    }
}

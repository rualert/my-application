namespace MyApplication.Application.Auth;

/// <summary>
///     Переданный refresh token отсутствует, просрочен или уже отозван.
/// </summary>
public class InvalidRefreshTokenException : ApplicationException
{
    public InvalidRefreshTokenException() : base("Refresh token недействителен.")
    {
    }
}

using MyApplication.Application.Auth;

namespace MyApplication.Tests.UseCasesTests.Auth.Harness;

/// <summary>
///     Тестовый двойник <see cref="IGoogleIdTokenValidator"/> — единственный
///     Application-порт, который допустимо подменять: он оборачивает внешний
///     сторонний сервис (серверы Google), а не нашу собственную инфраструктуру.
///     Если <see cref="NextResult"/> не задан явно, профиль выводится прямо из
///     переданного <c>idToken</c> (используется как Google subject) — это
///     позволяет смок-тестам, где на каждый HTTP-запрос создаётся новый
///     экземпляр этого класса (DI Scoped), различать «пользователей» просто
///     передавая разные значения idToken. <see cref="FailNextValidation"/>
///     заставляет следующий вызов бросить <see cref="InvalidGoogleTokenException"/>,
///     как это делает настоящий валидатор для невалидного токена.
/// </summary>
public class FakeGoogleIdTokenValidator : IGoogleIdTokenValidator
{
    public GoogleUserInfo? NextResult { get; set; }

    public bool FailNextValidation { get; set; }

    public Task<GoogleUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        if (FailNextValidation)
        {
            throw new InvalidGoogleTokenException();
        }

        var result = NextResult ?? new GoogleUserInfo(idToken, $"{idToken}@example.com", "Тестовый пользователь");
        return Task.FromResult(result);
    }
}

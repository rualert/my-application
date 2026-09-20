namespace MyApplication.Application.Auth;

/// <summary>
///     Порт реакции на регистрацию нового пользователя. Фича «Auth» ничего не
///     знает о том, что именно должно произойти вокруг регистрации (сейчас —
///     создание приветственной заметки в фиче «Notes»): реализацию подставляет
///     composition root, зависимость направлена от Notes к Auth, а не наоборот.
/// </summary>
public interface IUserRegistrationHandler
{
    /// <summary>
    ///     Вызывается один раз для нового пользователя — после того, как он
    ///     сохранён, при его первом входе через Google. Повторные входы не
    ///     вызывают его. Исключение прерывает вход (см. <see cref="AuthService"/>,
    ///     почему регистрация и эта реакция не атомарны).
    /// </summary>
    Task OnUserRegisteredAsync(Guid userId, CancellationToken cancellationToken);
}

using MyApplication.Application.Auth;

namespace MyApplication.Application.Notes;

/// <summary>
///     Создаёт приветственную заметку (<see cref="WelcomeNote"/>) новому
///     пользователю. Заметка — обычная: её можно изменить или удалить, заново
///     она не появится, потому что вызывается только при регистрации.
/// </summary>
public class WelcomeNoteRegistrationHandler : IUserRegistrationHandler
{
    private readonly INoteService _noteService;

    /// <summary>
    ///     Создаёт обработчик поверх сервиса заметок.
    /// </summary>
    public WelcomeNoteRegistrationHandler(INoteService noteService)
    {
        _noteService = noteService;
    }

    /// <summary>
    ///     Создаёт пользователю <paramref name="userId"/> приветственную заметку.
    /// </summary>
    public async Task OnUserRegisteredAsync(Guid userId, CancellationToken cancellationToken)
    {
        await _noteService.CreateAsync(userId, WelcomeNote.Title, WelcomeNote.Text, cancellationToken);
    }
}

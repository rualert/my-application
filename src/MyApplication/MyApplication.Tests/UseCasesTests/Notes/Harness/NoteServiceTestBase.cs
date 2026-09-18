using Microsoft.EntityFrameworkCore;
using MyApplication.Application.Notes;
using MyApplication.Infrastructure.Notes;

namespace MyApplication.Tests.UseCasesTests.Notes.Harness;

/// <summary>
///     Базовый класс для тестов use case'ов фичи «Заметки». Поднимает
///     <see cref="INoteService"/> поверх настоящих <see cref="NoteRepository"/>
///     и <see cref="NotesDbContext"/> — реализация Infrastructure-слоя не
///     подменяется, чтобы её собственная логика (если появится) тоже
///     проверялась этими тестами. Вместо реального PostgreSQL — провайдер
///     EF Core InMemory с уникальной базой на каждый тест.
/// </summary>
public abstract class NoteServiceTestBase : IDisposable
{
    private readonly NotesDbContext _context;

    protected NoteServiceTestBase()
    {
        var options = new DbContextOptionsBuilder<NotesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new NotesDbContext(options);

        Sut = new NoteService(new NoteRepository(_context));
    }

    /// <summary>
    ///     Сервис под тестом — единственная точка входа, через которую тесты
    ///     сценариев обращаются к SUT (чёрный ящик, без обращения к деталям реализации).
    /// </summary>
    protected INoteService Sut { get; }

    /// <summary>
    ///     Идентификатор пользователя, от имени которого сценарии обычно
    ///     вызывают SUT. Авторизация уже считается пройденной на этом этапе —
    ///     достаточно передать литеральный Guid, без обращения к Auth-фиче.
    /// </summary>
    protected static Guid CallerUserId { get; } = Guid.NewGuid();

    /// <summary>
    ///     Идентификатор другого пользователя — для сценариев доступа к чужим заметкам.
    /// </summary>
    protected static Guid OtherUserId { get; } = Guid.NewGuid();

    /// <summary>
    ///     Освобождает контекст EF Core вместе с его in-memory базой данных теста.
    /// </summary>
    public void Dispose()
    {
        _context.Dispose();
    }
}

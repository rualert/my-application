using MyApplication.Application.Notes;
using MyApplication.Infrastructure.Notes;
using MyApplication.Tests.IntegrationTests.Harness;

namespace MyApplication.Tests.IntegrationTests.Notes.Harness;

/// <summary>
///     Базовый класс для интеграционных тестов фичи «Заметки». Поднимает
///     <see cref="INoteService"/> поверх настоящих <see cref="NoteRepository"/> и
///     <see cref="NotesDbContext"/>, как и <c>UseCasesTests</c>, но против
///     настоящего PostgreSQL из <see cref="PostgresFixture"/> — иначе не
///     проверить то, что считает сама СУБД.
/// </summary>
[Collection(IntegrationTestCollection.Name)]
public abstract class NoteServiceIntegrationTestBase : IAsyncLifetime
{
    private readonly PostgresFixture _fixture;
    private NotesDbContext _context = null!;

    protected NoteServiceIntegrationTestBase(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    /// <summary>
    ///     Сервис под тестом — единственная точка входа, через которую тесты
    ///     сценариев обращаются к SUT (чёрный ящик, без обращения к деталям реализации).
    /// </summary>
    protected INoteService Sut { get; private set; } = null!;

    /// <summary>
    ///     Идентификатор пользователя, от имени которого сценарии обычно
    ///     вызывают SUT. Авторизация на этом уровне уже считается пройденной.
    /// </summary>
    protected static Guid CallerUserId { get; } = Guid.NewGuid();

    /// <summary>
    ///     Идентификатор другого пользователя — для сценариев с чужими заметками.
    /// </summary>
    protected static Guid OtherUserId { get; } = Guid.NewGuid();

    /// <summary>
    ///     Очищает данные в базе и собирает SUT поверх свежего контекста.
    /// </summary>
    public async Task InitializeAsync()
    {
        await _fixture.ResetAsync();
        _context = _fixture.CreateNotesContext();
        Sut = new NoteService(new NoteRepository(_context));
    }

    /// <summary>
    ///     Освобождает контекст теста — контейнер живёт до конца сессии.
    /// </summary>
    public async Task DisposeAsync()
    {
        await _context.DisposeAsync();
    }
}

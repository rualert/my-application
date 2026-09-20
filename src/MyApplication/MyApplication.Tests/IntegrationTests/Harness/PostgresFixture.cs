using Microsoft.EntityFrameworkCore;
using MyApplication.Infrastructure.Notes;
using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;

namespace MyApplication.Tests.IntegrationTests.Harness;

/// <summary>
///     Общая инфраструктура интеграционных тестов: один контейнер PostgreSQL на
///     всю сессию, со схемой, накатанной теми же миграциями EF Core, что и в
///     проде. Между сценариями данные очищаются через <see cref="ResetAsync"/>
///     (Respawn), контейнер не пересоздаётся.
///     Нужен там, где провайдер EF Core InMemory из <c>UseCasesTests</c>
///     принципиально не подходит — он не выполняет SQL и не знает ничего про
///     возможности самой СУБД (например, про поиск по триграммам).
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17")
        .WithDatabase("myapplication")
        .WithUsername("myapplication")
        .WithPassword("myapplication")
        .Build();

    private NpgsqlConnection _connection = null!;
    private Respawner _respawner = null!;

    /// <summary>
    ///     Поднимает контейнер, накатывает миграции и готовит Respawn для
    ///     последующей очистки данных между тестами.
    /// </summary>
    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        await using (var context = CreateNotesContext())
        {
            await context.Database.MigrateAsync();
        }

        _connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await _connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(_connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
        });
    }

    /// <summary>
    ///     Создаёт настоящий контекст заметок поверх контейнера. Владение
    ///     контекстом — на вызывающем.
    /// </summary>
    public NotesDbContext CreateNotesContext()
    {
        var options = new DbContextOptionsBuilder<NotesDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        return new NotesDbContext(options);
    }

    /// <summary>
    ///     Очищает все данные в базе, оставляя схему нетронутой.
    /// </summary>
    public Task ResetAsync()
    {
        return _respawner.ResetAsync(_connection);
    }

    /// <summary>
    ///     Освобождает соединение и контейнер по завершении сессии тестов.
    /// </summary>
    public async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

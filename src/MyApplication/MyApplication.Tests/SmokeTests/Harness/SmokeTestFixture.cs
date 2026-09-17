using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Respawn;
using Testcontainers.PostgreSql;

namespace MyApplication.Tests.SmokeTests.Harness;

/// <summary>
///     Общая инфраструктура для смок-тестов: один контейнер PostgreSQL и один
///     экземпляр приложения (через <see cref="WebApplicationFactory{TEntryPoint}"/>,
///     весь HTTP-конвейер целиком, без подмен) на всю сессию тестов. Между
///     сценариями данные в базе очищаются через <see cref="ResetAsync"/>
///     (Respawn), сам контейнер и приложение не пересоздаются.
/// </summary>
public sealed class SmokeTestFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17")
        .WithDatabase("myapplication")
        .WithUsername("myapplication")
        .WithPassword("myapplication")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;
    private NpgsqlConnection _connection = null!;
    private Respawner _respawner = null!;

    /// <summary>
    ///     HTTP-клиент приложения — единственная точка входа для смок-тестов (SUT).
    /// </summary>
    public HttpClient Sut { get; private set; } = null!;

    /// <summary>
    ///     Поднимает контейнер PostgreSQL и приложение поверх него (миграции
    ///     применяются самим приложением при старте, как в проде), затем
    ///     готовит Respawn для последующей очистки данных между тестами.
    /// </summary>
    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Notes"] = _postgres.GetConnectionString(),
                });
            });
        });

        Sut = _factory.CreateClient();

        _connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await _connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(_connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
        });
    }

    /// <summary>
    ///     Очищает все данные в базе, оставляя схему нетронутой. Вызывается
    ///     перед каждым сценарием, чтобы тесты не зависели друг от друга.
    /// </summary>
    public Task ResetAsync()
    {
        return _respawner.ResetAsync(_connection);
    }

    /// <summary>
    ///     Освобождает соединение, приложение и контейнер по завершении сессии тестов.
    /// </summary>
    public async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

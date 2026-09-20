using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MyApplication.Application.Auth;
using MyApplication.Infrastructure.Auth;
using MyApplication.Infrastructure.Notes;
using MyApplication.Tests.UseCasesTests.Auth.Harness;
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
                    ["ConnectionStrings:Users"] = _postgres.GetConnectionString(),
                    ["Jwt:Issuer"] = "MyApplication.Tests",
                    ["Jwt:Audience"] = "MyApplication.Tests",
                    ["Jwt:SigningKey"] = "test-signing-key-at-least-32-bytes-long!",
                    ["Jwt:AccessTokenLifetimeMinutes"] = "15",
                    ["Google:ClientId"] = "test-client-id",
                });
            });

            // Настоящий IGoogleIdTokenValidator дёргает серверы Google — недоступно
            // в CI/локально без реального Google-аккаунта. Единственная подмена
            // в смок-тестах: вся остальная инфраструктура (Postgres, репозитории,
            // выпуск собственных JWT) остаётся настоящей.
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Scoped<IGoogleIdTokenValidator, FakeGoogleIdTokenValidator>());
            });
        });

        Sut = _factory.CreateClient();

        _connection = new NpgsqlConnection(_postgres.GetConnectionString());
        await _connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(_connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            // Схема у каждого DbContext своя: перечислить нужно все. Пропущенную схему
            // Respawn не тронет и не пожалуется (ошибка «No tables found» будет, только
            // если таблиц нет ни в одной из перечисленных) — данные из неё начнут
            // переходить из теста в тест.
            SchemasToInclude = [AuthDbContext.SchemaName, NotesDbContext.SchemaName],
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

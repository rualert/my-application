namespace MyApplication.Tests.SmokeTests.Harness;

/// <summary>
///     Базовый класс для смок-тестов. Даёт доступ к общему HTTP-клиенту
///     приложения (<see cref="SmokeTestFixture"/> на всю сессию) и очищает
///     данные в базе перед каждым тестом, чтобы сценарии не влияли друг на друга.
/// </summary>
[Collection(SmokeTestCollection.Name)]
public abstract class SmokeTestBase : IAsyncLifetime
{
    private readonly SmokeTestFixture _fixture;

    protected SmokeTestBase(SmokeTestFixture fixture)
    {
        _fixture = fixture;
    }

    /// <summary>
    ///     HTTP-клиент приложения — единственная точка входа для тестов (SUT,
    ///     весь сервис как чёрный ящик, без обращения к деталям реализации).
    /// </summary>
    protected HttpClient Sut => _fixture.Sut;

    /// <summary>
    ///     Очищает данные в базе перед очередным тестом.
    /// </summary>
    public Task InitializeAsync()
    {
        return _fixture.ResetAsync();
    }

    /// <summary>
    ///     Ничего не делает — ресурсы сессии освобождает <see cref="SmokeTestFixture"/>.
    /// </summary>
    public Task DisposeAsync()
    {
        return Task.CompletedTask;
    }
}

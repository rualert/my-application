namespace MyApplication.Tests.IntegrationTests.Harness;

/// <summary>
///     xUnit-коллекция для интеграционных тестов: все тесты, помеченные
///     <c>[Collection(Name)]</c>, используют один общий <see cref="PostgresFixture"/>
///     (один контейнер БД на всю сессию тестов).
/// </summary>
[CollectionDefinition(Name)]
public class IntegrationTestCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Integration tests";
}

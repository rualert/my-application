namespace MyApplication.Tests.SmokeTests.Harness;

/// <summary>
///     xUnit-коллекция для смок-тестов: все тесты, помеченные
///     <c>[Collection(Name)]</c>, используют один общий <see cref="SmokeTestFixture"/>
///     (один контейнер БД и один экземпляр приложения на всю сессию тестов).
/// </summary>
[CollectionDefinition(Name)]
public class SmokeTestCollection : ICollectionFixture<SmokeTestFixture>
{
    public const string Name = "Smoke tests";
}

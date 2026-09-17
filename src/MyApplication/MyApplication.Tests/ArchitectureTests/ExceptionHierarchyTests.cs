using System.Reflection;
using MyApplication.Domain;

namespace MyApplication.Tests.ArchitectureTests;

/// <summary>
///     Архитектурные тесты на иерархию исключений: все исключения, объявленные
///     в решении, должны так или иначе наследоваться от <see cref="DomainException"/>.
/// </summary>
public class ExceptionHierarchyTests
{
    private const string SolutionAssemblyPrefix = "MyApplication.";
    private const string ApiAssemblyName = "MyApplication.Api";

    /// <summary>
    ///     Проверяет, что любой тип-исключение, объявленный в сборках решения
    ///     (найденных обходом графа ссылок от <see cref="ApiAssemblyName"/>),
    ///     либо сам является <see cref="DomainException"/>, либо наследуется от него.
    /// </summary>
    [Fact]
    public void AllDeclaredExceptions_ShouldInheritFromDomainException()
    {
        var offendingTypes = GetSolutionAssemblies()
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type.IsClass && typeof(Exception).IsAssignableFrom(type))
            .Where(type => type != typeof(DomainException))
            .Where(type => !typeof(DomainException).IsAssignableFrom(type))
            .Select(type => type.FullName)
            .Order()
            .ToArray();

        Assert.True(
            offendingTypes.Length == 0,
            $"Найдены исключения, не унаследованные от {nameof(DomainException)}: {string.Join(", ", offendingTypes)}");
    }

    /// <summary>
    ///     Обходит граф ссылок между сборками, начиная с <see cref="ApiAssemblyName"/>,
    ///     и возвращает все достижимые из него сборки решения (имя которых начинается
    ///     с <see cref="SolutionAssemblyPrefix"/>). Новый проект, на который начинает
    ///     ссылаться Api (прямо или транзитивно), подхватывается автоматически —
    ///     список сборок не нужно поддерживать вручную.
    /// </summary>
    private static IReadOnlyCollection<Assembly> GetSolutionAssemblies()
    {
        var visited = new Dictionary<string, Assembly>(StringComparer.Ordinal);
        var toVisit = new Queue<Assembly>();
        toVisit.Enqueue(Assembly.Load(ApiAssemblyName));

        while (toVisit.Count > 0)
        {
            var assembly = toVisit.Dequeue();
            var name = assembly.GetName().Name!;

            if (!visited.TryAdd(name, assembly))
            {
                continue;
            }

            foreach (var reference in assembly.GetReferencedAssemblies())
            {
                if (reference.Name is { } referenceName && referenceName.StartsWith(SolutionAssemblyPrefix, StringComparison.Ordinal))
                {
                    toVisit.Enqueue(Assembly.Load(reference));
                }
            }
        }

        return visited.Values;
    }
}

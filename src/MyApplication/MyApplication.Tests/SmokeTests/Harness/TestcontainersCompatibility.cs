using System.Runtime.CompilerServices;

namespace MyApplication.Tests.SmokeTests.Harness;

/// <summary>
///     Совместимость с версией Docker API на машине разработчика. Docker.DotNet
///     (транзитивная зависимость Testcontainers) по умолчанию запрашивает более
///     новую версию Docker API, чем поддерживают некоторые установки Docker
///     Desktop — демон в ответ отдаёт ошибку вида «client version X.XX is too
///     new». Явно фиксируем версию API перед первым использованием
///     Testcontainers, если она не задана снаружи (переменной окружения или CI).
/// </summary>
internal static class TestcontainersCompatibility
{
    [ModuleInitializer]
    public static void PinDockerApiVersion()
    {
        if (Environment.GetEnvironmentVariable("DOCKER_API_VERSION") is null)
        {
            Environment.SetEnvironmentVariable("DOCKER_API_VERSION", "1.41");
        }
    }
}

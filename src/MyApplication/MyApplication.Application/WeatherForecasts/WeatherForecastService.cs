namespace MyApplication.Application.WeatherForecasts;

public class WeatherForecastService : IWeatherForecastService
{
    private static readonly string[] Summaries =
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    /// <summary>
    ///     Формирует прогноз погоды на ближайшие 5 дней со случайными значениями температуры и описания.
    /// </summary>
    /// <returns>Коллекция из пяти прогнозов погоды — по одному на каждый из следующих пяти дней.</returns>
    public IEnumerable<WeatherForecast> GetForecasts()
    {
        return Enumerable.Range(1, 5).Select(index =>
                new WeatherForecast
                (
                    DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                    Random.Shared.Next(-20, 55),
                    Summaries[Random.Shared.Next(Summaries.Length)]
                ))
            .ToArray();
    }
}

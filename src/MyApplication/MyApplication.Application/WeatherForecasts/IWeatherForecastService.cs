namespace MyApplication.Application.WeatherForecasts;

public interface IWeatherForecastService
{
    /// <summary>
    ///     Возвращает прогноз погоды.
    /// </summary>
    /// <returns>Коллекция прогнозов погоды.</returns>
    IEnumerable<WeatherForecast> GetForecasts();
}

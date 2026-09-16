using Microsoft.AspNetCore.Mvc;
using MyApplication.Application.WeatherForecasts;

namespace MyApplication.Api.Controllers;

/// <summary>
///     Тестовый метод, который делает хоть что-то
/// </summary>
[ApiController]
[Route("[controller]")]
public class WeatherForecastController : ControllerBase
{
    private readonly IWeatherForecastService _weatherForecastService;

    /// <summary>
    ///     Создаёт экземпляр контроллера с внедрённым сервисом прогнозов погоды.
    /// </summary>
    /// <param name="weatherForecastService">Сервис, предоставляющий прогнозы погоды.</param>
    public WeatherForecastController(IWeatherForecastService weatherForecastService)
    {
        _weatherForecastService = weatherForecastService;
    }

    /// <summary>
    ///     Возвращает прогноз погоды.
    /// </summary>
    /// <returns>Коллекция прогнозов погоды.</returns>
    [HttpGet(Name = "GetWeatherForecast")]
    public IEnumerable<WeatherForecast> Get()
    {
        return _weatherForecastService.GetForecasts();
    }
}

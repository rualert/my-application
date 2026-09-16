using Elastic.Ingest.Elasticsearch.DataStreams;
using Elastic.Serilog.Sinks;
using Microsoft.EntityFrameworkCore;
using MyApplication.Api;
using MyApplication.Application.Notes;
using MyApplication.Application.WeatherForecasts;
using MyApplication.Infrastructure.Notes;
using Npgsql;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, _, loggerConfiguration) =>
{
    var elasticsearchUri = context.Configuration["Elasticsearch:Uri"] ?? "http://localhost:9200";

    loggerConfiguration
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", context.HostingEnvironment.ApplicationName)
        .WriteTo.Console()
        .WriteTo.Elasticsearch([new Uri(elasticsearchUri)], options =>
        {
            options.DataStream = new DataStreamName("logs", "myapplication-api", context.HostingEnvironment.EnvironmentName.ToLowerInvariant());
        });
});

// Регистрация сервисов.
// Подробнее про настройку OpenAPI: https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddScoped<IWeatherForecastService, WeatherForecastService>();

// Глобальная обработка исключений: любое DomainException (из слоя Domain или
// Application) маппится на 400 Bad Request, поэтому контроллерам не нужен свой
// try/catch. Всё остальное остаётся необработанным и отдаётся как общий
// ProblemDetails-ответ 500.
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddDbContext<NotesDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Notes")));
builder.Services.AddScoped<INoteRepository, NoteRepository>();
builder.Services.AddScoped<INoteService, NoteService>();

// Распределённая трассировка: каждый входящий запрос и каждый исходящий вызов
// через HttpClient получает Activity в формате W3C trace-context, который
// прокидывается между сервисами через заголовок `traceparent`. Serilog/ECS уже
// проставляет тот же trace.id/span.id в строки логов, поэтому логи и трейсы
// коррелируют автоматически. При добавлении клиента БД или очереди сообщений
// здесь же нужно подключить соответствующую OpenTelemetry-инструментацию.
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(builder.Environment.ApplicationName))
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddNpgsql();

        var otlpEndpoint = builder.Configuration["OpenTelemetry:OtlpEndpoint"];
        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            tracing.AddOtlpExporter(options => options.Endpoint = new Uri(otlpEndpoint));
        }
    });

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<NotesDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();

app.UseSerilogRequestLogging();

// Настройка конвейера обработки HTTP-запросов.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.MapControllers();

app.Run();

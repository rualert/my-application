using Elastic.Ingest.Elasticsearch.DataStreams;
using Elastic.Serilog.Sinks;
using MyApplication.Application.WeatherForecasts;
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

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddScoped<IWeatherForecastService, WeatherForecastService>();

var app = builder.Build();

app.UseSerilogRequestLogging();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapControllers();

app.Run();

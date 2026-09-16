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

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddScoped<IWeatherForecastService, WeatherForecastService>();

// Global exception handling: any DomainException (Domain or Application layer)
// maps to 400 Bad Request, so controllers don't need their own try/catch. Anything
// else is unhandled and falls through to a generic ProblemDetails 500 response.
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddDbContext<NotesDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Notes")));
builder.Services.AddScoped<INoteRepository, NoteRepository>();
builder.Services.AddScoped<INoteService, NoteService>();

// Distributed tracing: every incoming request and every outgoing HTTP call made with
// HttpClient gets a W3C trace-context Activity, propagated across services via the
// `traceparent` header. Serilog/ECS already stamps log lines with the same trace.id/span.id,
// so logs and traces correlate automatically. When adding a database client or a message
// queue client, register matching OpenTelemetry instrumentation for it here too.
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.MapControllers();

app.Run();

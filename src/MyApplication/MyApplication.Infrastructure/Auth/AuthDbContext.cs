using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using MyApplication.Domain.Auth;

namespace MyApplication.Infrastructure.Auth;

public class AuthDbContext : DbContext
{
    /// <summary>
    ///     Схема PostgreSQL, в которой живут таблицы этого контекста и его же
    ///     таблица истории миграций. Свои схемы у каждого контекста — граница
    ///     bounded context'а видна и в самой базе, а истории миграций не смешиваются.
    /// </summary>
    public const string SchemaName = "auth";

    /// <summary>
    ///     Создаёт контекст EF Core с переданными опциями подключения.
    /// </summary>
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /// <summary>
    ///     Подключает контекст к PostgreSQL и кладёт таблицу истории миграций в
    ///     <see cref="SchemaName"/>. Единственное место, где это настраивается:
    ///     оба места создания контекста (приложение и тесты) идут через него, иначе
    ///     история оказалась бы не там, где её ищет <c>MigrateAsync()</c>.
    /// </summary>
    public static void ConfigureNpgsql(DbContextOptionsBuilder options, string? connectionString)
    {
        options.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable(HistoryRepository.DefaultTableName, SchemaName));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);

        modelBuilder.Entity<User>(builder =>
        {
            builder.ToTable("users");
            builder.HasKey(user => user.Id);
            builder.Property(user => user.GoogleSubjectId).IsRequired();
            builder.HasIndex(user => user.GoogleSubjectId).IsUnique();
            builder.Property(user => user.Email).IsRequired();
            builder.Property(user => user.Name).IsRequired();
            builder.Property(user => user.CreatedAt).IsRequired();
        });

        modelBuilder.Entity<RefreshToken>(builder =>
        {
            builder.ToTable("refresh_tokens");
            builder.HasKey(token => token.Id);
            builder.Property(token => token.UserId).IsRequired();
            builder.HasIndex(token => token.UserId);
            builder.Property(token => token.TokenHash).IsRequired();
            builder.HasIndex(token => token.TokenHash).IsUnique();
            builder.Property(token => token.CreatedAt).IsRequired();
            builder.Property(token => token.ExpiresAt).IsRequired();
            builder.Ignore(token => token.IsActive);
        });
    }
}

using Microsoft.EntityFrameworkCore;
using MyApplication.Domain.Auth;

namespace MyApplication.Infrastructure.Auth;

public class AuthDbContext : DbContext
{
    /// <summary>
    ///     Создаёт контекст EF Core с переданными опциями подключения.
    /// </summary>
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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

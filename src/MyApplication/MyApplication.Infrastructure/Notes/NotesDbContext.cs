using Microsoft.EntityFrameworkCore;
using MyApplication.Domain.Notes;

namespace MyApplication.Infrastructure.Notes;

public class NotesDbContext : DbContext
{
    /// <summary>
    ///     Создаёт контекст EF Core с переданными опциями подключения.
    /// </summary>
    public NotesDbContext(DbContextOptions<NotesDbContext> options) : base(options)
    {
    }

    public DbSet<Note> Notes => Set<Note>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Note>(builder =>
        {
            builder.ToTable("notes");
            builder.HasKey(note => note.Id);
            builder.Property(note => note.Title).HasMaxLength(Note.MaxTitleLength).IsRequired();
            builder.Property(note => note.Text).IsRequired();
            builder.Property(note => note.CreatedAt).IsRequired();
            builder.Property(note => note.UpdatedAt).IsRequired();
        });
    }
}

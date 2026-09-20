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
            // UserId — ссылка по идентификатору на пользователя из AuthDbContext,
            // без FK: Notes и Auth — разные bounded context'ы/DbContext'ы.
            builder.Property(note => note.UserId).IsRequired();
            builder.HasIndex(note => note.UserId);
            // Title необязателен: null — заметка без заголовка (см. Note.NormalizeTitle).
            builder.Property(note => note.Title).HasMaxLength(Note.MaxTitleLength);
            builder.Property(note => note.Text).IsRequired();
            // Version — токен параллелизма: EF добавляет его в WHERE у UPDATE, так что
            // два одновременных обновления одной заметки не затрут друг друга даже при
            // совпавших проверках версии в NoteService (см. NoteRepository.SaveChangesAsync).
            builder.Property(note => note.Version).IsRequired().IsConcurrencyToken();
            builder.Property(note => note.CreatedAt).IsRequired();
            builder.Property(note => note.UpdatedAt).IsRequired();
        });
    }
}

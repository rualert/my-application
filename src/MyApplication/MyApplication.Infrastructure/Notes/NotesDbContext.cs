using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using MyApplication.Domain.Notes;

namespace MyApplication.Infrastructure.Notes;

public class NotesDbContext : DbContext
{
    /// <summary>
    ///     Схема PostgreSQL, в которой живут таблицы этого контекста и его же
    ///     таблица истории миграций. Значение зашито и в сыром SQL поиска
    ///     (<see cref="NoteRepository.SearchAsync"/>) — при смене поправить и там.
    /// </summary>
    public const string SchemaName = "notes";

    /// <summary>
    ///     Создаёт контекст EF Core с переданными опциями подключения.
    /// </summary>
    public NotesDbContext(DbContextOptions<NotesDbContext> options) : base(options)
    {
    }

    public DbSet<Note> Notes => Set<Note>();

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

        // pg_trgm — сравнение строк по триграммам: на нём держится поиск с
        // опечатками (см. NoteRepository.SearchAsync).
        modelBuilder.HasPostgresExtension("pg_trgm");

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
            // Триграммные GIN-индексы: ускоряют и поиск подстроки (ILIKE '%...%'),
            // и поиск похожего фрагмента (оператор <%) в NoteRepository.SearchAsync —
            // обычный B-tree ни тому, ни другому не помогает.
            builder.HasIndex(note => note.Title)
                .HasDatabaseName("IX_notes_Title_trgm")
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops");
            builder.HasIndex(note => note.Text)
                .HasDatabaseName("IX_notes_Text_trgm")
                .HasMethod("gin")
                .HasOperators("gin_trgm_ops");
        });
    }
}

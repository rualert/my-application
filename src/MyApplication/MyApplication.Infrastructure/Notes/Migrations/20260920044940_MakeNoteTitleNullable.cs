using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyApplication.Infrastructure.Notes.Migrations
{
    /// <inheritdoc />
    public partial class MakeNoteTitleNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "notes",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024);

            // Раньше UI сам подставлял "Без заголовка" при сохранении заметки без заголовка;
            // теперь такая заметка хранится как NULL.
            migrationBuilder.Sql("UPDATE notes SET \"Title\" = NULL WHERE \"Title\" = 'Без заголовка';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Возвращаем прежнее представление "без заголовка" — колонка снова NOT NULL.
            migrationBuilder.Sql("UPDATE notes SET \"Title\" = 'Без заголовка' WHERE \"Title\" IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "notes",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024,
                oldNullable: true);
        }
    }
}

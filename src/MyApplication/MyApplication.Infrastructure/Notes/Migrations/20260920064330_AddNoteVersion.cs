using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyApplication.Infrastructure.Notes.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // defaultValue выставлен в Note.InitialVersion (1), а не в сгенерированный
            // EF ноль: уже существующие заметки должны выглядеть как только что
            // созданные, а не как «версия 0», которой в доменной модели не бывает.
            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "notes",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Version",
                table: "notes");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyApplication.Infrastructure.Notes.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "notes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_notes_UserId",
                table: "notes",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_notes_UserId",
                table: "notes");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "notes");
        }
    }
}

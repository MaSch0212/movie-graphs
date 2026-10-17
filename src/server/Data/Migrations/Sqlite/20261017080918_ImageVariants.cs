using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieGraphs.Data.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class ImageVariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The variants of the existing images are created after the migrations on startup
            // (see ImageVariantMigration), because scaling them needs code, not SQL.
            migrationBuilder.AddColumn<bool>(
                name: "variants_created",
                table: "images",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "image_variants",
                columns: table => new
                {
                    image_id = table.Column<long>(type: "INTEGER", nullable: false),
                    width = table.Column<int>(type: "INTEGER", nullable: false),
                    data = table.Column<byte[]>(type: "BLOB", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_image_variants", x => new { x.image_id, x.width });
                    table.ForeignKey(
                        name: "FK_image_variants_images_image_id",
                        column: x => x.image_id,
                        principalTable: "images",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "image_variants");

            migrationBuilder.DropColumn(
                name: "variants_created",
                table: "images");
        }
    }
}

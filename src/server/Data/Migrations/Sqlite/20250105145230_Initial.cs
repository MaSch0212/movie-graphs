using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieGraphs.Data.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "graphs",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_graphs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "images",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    data = table.Column<byte[]>(type: "BLOB", nullable: false),
                    last_modified = table.Column<DateTimeOffset>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_images", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "templates",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    template = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_templates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "graph_nodes",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    graph_id = table.Column<long>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    image_id = table.Column<long>(type: "INTEGER", nullable: false),
                    watched = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_graph_nodes", x => x.id);
                    table.ForeignKey(
                        name: "FK_graph_nodes_graphs_graph_id",
                        column: x => x.graph_id,
                        principalTable: "graphs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_graph_nodes_images_image_id",
                        column: x => x.image_id,
                        principalTable: "images",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "graph_edges",
                columns: table => new
                {
                    source_node_id = table.Column<long>(type: "INTEGER", nullable: false),
                    target_node_id = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_graph_edges", x => new { x.source_node_id, x.target_node_id });
                    table.ForeignKey(
                        name: "FK_graph_edges_graph_nodes_source_node_id",
                        column: x => x.source_node_id,
                        principalTable: "graph_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_graph_edges_graph_nodes_target_node_id",
                        column: x => x.target_node_id,
                        principalTable: "graph_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_graph_edges_target_node_id",
                table: "graph_edges",
                column: "target_node_id");

            migrationBuilder.CreateIndex(
                name: "IX_graph_nodes_graph_id",
                table: "graph_nodes",
                column: "graph_id");

            migrationBuilder.CreateIndex(
                name: "IX_graph_nodes_image_id",
                table: "graph_nodes",
                column: "image_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "graph_edges");

            migrationBuilder.DropTable(
                name: "templates");

            migrationBuilder.DropTable(
                name: "graph_nodes");

            migrationBuilder.DropTable(
                name: "graphs");

            migrationBuilder.DropTable(
                name: "images");
        }
    }
}

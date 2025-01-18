using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieGraphs.Data.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class MoreNodeDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "watched",
                table: "graph_nodes",
                newName: "status");
            migrationBuilder.Sql("UPDATE graph_nodes SET status = 2 WHERE status = 1");

            migrationBuilder.AddColumn<TimeSpan>(
                name: "duration",
                table: "graph_nodes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "where_to_watch",
                table: "graph_nodes",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "duration",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "where_to_watch",
                table: "graph_nodes");

            migrationBuilder.Sql("UPDATE graph_nodes SET status = 1 WHERE status = 2");
            migrationBuilder.RenameColumn(
                name: "status",
                table: "graph_nodes",
                newName: "watched");
        }
    }
}

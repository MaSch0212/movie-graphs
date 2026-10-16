using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieGraphs.Data.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class TitleDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "episode_from",
                table: "graph_nodes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "episode_to",
                table: "graph_nodes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "season",
                table: "graph_nodes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "short_name",
                table: "graph_nodes",
                type: "TEXT",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "type",
                table: "graph_nodes",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "year",
                table: "graph_nodes",
                type: "INTEGER",
                nullable: true);

            // Split the details that used to be part of the name, e.g.
            // "Agents of S.H.I.E.L.D.: S1, E1-7 (2013)" or "Loki: Staffel 2 (2023)".
            // Names that don't match exactly are kept as they are.
            migrationBuilder.Sql(
                """
                UPDATE graph_nodes
                SET year = CAST(substr(name, length(name) - 4, 4) AS INTEGER),
                    name = rtrim(substr(name, 1, length(name) - 7))
                WHERE name GLOB '* ([0-9][0-9][0-9][0-9])';
                """
            );
            foreach (var (label, length) in new[] { ("Staffel", 10), ("Season", 9) })
            {
                migrationBuilder.Sql(
                    $"""
                    UPDATE graph_nodes
                    SET type = 1,
                        season = CAST(substr(name, instr(name, ': {label} ') + {length}) AS INTEGER),
                        name = substr(name, 1, instr(name, ': {label} ') - 1)
                    WHERE name GLOB '*: {label} [0-9]' OR name GLOB '*: {label} [0-9][0-9]';
                    """
                );
            }
            // "S1", "S1, E5" or "S1, E1-7"; the text after ": S" may only contain these characters.
            const string suffix = "substr(name, instr(name, ': S') + 3)";
            migrationBuilder.Sql(
                $"""
                UPDATE graph_nodes
                SET type = 1,
                    season = CAST({suffix} AS INTEGER),
                    episode_from = CASE WHEN instr({suffix}, 'E') > 0
                        THEN CAST(substr({suffix}, instr({suffix}, 'E') + 1) AS INTEGER) END,
                    episode_to = CASE WHEN instr({suffix}, '-') > 0
                        THEN CAST(substr({suffix}, instr({suffix}, '-') + 1) AS INTEGER) END,
                    name = substr(name, 1, instr(name, ': S') - 1)
                WHERE name GLOB '*: S[0-9]*'
                    AND {suffix} GLOB '[0-9]*'
                    AND {suffix} NOT GLOB '*[^0-9, E-]*';
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE graph_nodes
                SET name = name
                    || CASE
                        WHEN season IS NULL THEN ''
                        WHEN episode_from IS NULL THEN ': Staffel ' || season
                        ELSE ': S' || season || ', E' || episode_from || COALESCE('-' || episode_to, '')
                    END
                    || CASE WHEN year IS NULL THEN '' ELSE ' (' || year || ')' END;
                """
            );

            migrationBuilder.DropColumn(
                name: "episode_from",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "episode_to",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "season",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "short_name",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "type",
                table: "graph_nodes");

            migrationBuilder.DropColumn(
                name: "year",
                table: "graph_nodes");
        }
    }
}

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MovieGraphs.Data.Entities;
using MovieGraphs.Options;

namespace MovieGraphs.Data;

public class DatabaseContext(
    IOptions<DatabaseOptions> dbOptions,
    ILoggerFactory loggerFactory,
    IOptions<LoggingOptions> loggingOptions
) : DbContext
{
    public DbSet<GraphEntity> Graphs { get; set; } = null!;
    public DbSet<GraphNodeEntity> Nodes { get; set; } = null!;
    public DbSet<GraphEdgeEntity> Edges { get; set; } = null!;
    public DbSet<ImageEntity> Images { get; set; } = null!;
    public DbSet<TemplateEntity> Templates { get; set; } = null!;

    public GraphEntity GraphById(long id)
    {
        var existing = ChangeTracker.Entries<GraphEntity>().FirstOrDefault(x => x.Entity.Id == id);
        if (existing != null)
            return existing.Entity;
        var entity = new GraphEntity { Id = id, Name = null! };
        Entry(entity).State = EntityState.Unchanged;
        return entity;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        ConfigureSqlite(optionsBuilder, dbOptions.Value.ConnectionString);

        if (loggingOptions.Value.EnableDbLogging)
        {
            optionsBuilder.UseLoggerFactory(loggerFactory);
#if DEBUG
            optionsBuilder.EnableSensitiveDataLogging();
#endif
        }
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<GraphEntity>(GraphEntity.Configure);
        builder.Entity<GraphNodeEntity>(GraphNodeEntity.Configure);
        builder.Entity<GraphEdgeEntity>(GraphEdgeEntity.Configure);
        builder.Entity<ImageEntity>(ImageEntity.Configure);
        builder.Entity<TemplateEntity>(TemplateEntity.Configure);
    }

    private static DbContextOptionsBuilder ConfigureSqlite(
        DbContextOptionsBuilder options,
        string connectionString
    )
    {
        var parsedConStr = new SqliteConnectionStringBuilder(connectionString);

        parsedConStr.DataSource = Path.GetFullPath(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, parsedConStr.DataSource)
        );

        Directory.CreateDirectory(
            Path.GetDirectoryName(parsedConStr.DataSource)
                ?? throw new ArgumentException(
                    "Invalid connection string",
                    nameof(connectionString)
                )
        );

        return options.UseSqlite(
            parsedConStr.ConnectionString,
            o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
        );
    }
}

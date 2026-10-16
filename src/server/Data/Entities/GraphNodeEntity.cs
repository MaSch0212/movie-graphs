using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public enum GraphNodeStatus
{
    Unwatched,
    Watching,
    Watched,
    Ignored,
}

public enum GraphNodeType
{
    Movie,
    Series,
}

public class GraphNodeEntity
{
    public long Id { get; set; }
    public long GraphId { get; set; }

    /// <summary>The title, without year, season or episodes.</summary>
    public string Name { get; set; } = null!;

    /// <summary>A shorter title for places with little space, e.g. labels in the graph.</summary>
    public string? ShortName { get; set; }
    public GraphNodeType Type { get; set; } = GraphNodeType.Movie;
    public int? Year { get; set; }

    /// <summary>The season of a series.</summary>
    public int? Season { get; set; }

    /// <summary>The first episode of a series that belongs to this node.</summary>
    public int? EpisodeFrom { get; set; }

    /// <summary>The last episode, if the node covers a range of episodes.</summary>
    public int? EpisodeTo { get; set; }
    public long ImageId { get; set; }
    public GraphNodeStatus Status { get; set; } = GraphNodeStatus.Unwatched;
    public TimeSpan? Duration { get; set; }
    public string? WhereToWatch { get; set; }

    public GraphEntity Graph { get; set; } = null!;
    public ImageEntity Image { get; set; } = null!;
    public List<GraphEdgeEntity> OutgoingEdges { get; set; } = [];
    public List<GraphEdgeEntity> IncomingEdges { get; set; } = [];

    public static void Configure(EntityTypeBuilder<GraphNodeEntity> builder)
    {
        builder.ToTable("graph_nodes");

        builder.Property(x => x.Id).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.GraphId).HasColumnName("graph_id").IsRequired();
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder
            .Property(x => x.ShortName)
            .HasColumnName("short_name")
            .HasMaxLength(255)
            .IsRequired(false);
        builder.Property(x => x.Type).HasColumnName("type").IsRequired();
        builder.Property(x => x.Year).HasColumnName("year").IsRequired(false);
        builder.Property(x => x.Season).HasColumnName("season").IsRequired(false);
        builder.Property(x => x.EpisodeFrom).HasColumnName("episode_from").IsRequired(false);
        builder.Property(x => x.EpisodeTo).HasColumnName("episode_to").IsRequired(false);
        builder.Property(x => x.ImageId).HasColumnName("image_id").IsRequired();
        builder.Property(x => x.Status).HasColumnName("status").IsRequired();
        builder.Property(x => x.Duration).HasColumnName("duration").IsRequired(false);
        builder.Property(x => x.WhereToWatch).HasColumnName("where_to_watch").IsRequired(false);

        builder
            .HasOne(x => x.Graph)
            .WithMany(x => x.Nodes)
            .HasForeignKey(x => x.GraphId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(x => x.Image)
            .WithMany()
            .HasForeignKey(x => x.ImageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasKey(x => x.Id);
    }
}

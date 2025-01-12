using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public class GraphNodeEntity
{
    public long Id { get; set; }
    public long GraphId { get; set; }
    public string Name { get; set; } = null!;
    public long ImageId { get; set; }
    public bool Watched { get; set; } = false;

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
        builder.Property(x => x.ImageId).HasColumnName("image_id").IsRequired();
        builder.Property(x => x.Watched).HasColumnName("watched").IsRequired();

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

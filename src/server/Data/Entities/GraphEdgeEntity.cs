using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public class GraphEdgeEntity
{
    public long SourceNodeId { get; set; }
    public long TargetNodeId { get; set; }

    public GraphNodeEntity SourceNode { get; set; } = null!;
    public GraphNodeEntity TargetNode { get; set; } = null!;

    public static void Configure(EntityTypeBuilder<GraphEdgeEntity> builder)
    {
        builder.ToTable("graph_edges");

        builder.Property(x => x.SourceNodeId).HasColumnName("source_node_id").IsRequired();
        builder.Property(x => x.TargetNodeId).HasColumnName("target_node_id").IsRequired();

        builder
            .HasOne(x => x.SourceNode)
            .WithMany(x => x.OutgoingEdges)
            .HasForeignKey(x => x.SourceNodeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(x => x.TargetNode)
            .WithMany(x => x.IncomingEdges)
            .HasForeignKey(x => x.TargetNodeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasKey(x => new { x.SourceNodeId, x.TargetNodeId });
    }
}

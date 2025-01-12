using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public class GraphEntity
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;

    public List<GraphNodeEntity> Nodes { get; set; } = [];

    public static void Configure(EntityTypeBuilder<GraphEntity> builder)
    {
        builder.ToTable("graphs");

        builder.Property(x => x.Id).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();

        builder.HasKey(x => x.Id);
    }
}

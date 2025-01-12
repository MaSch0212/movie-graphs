using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MovieGraphs.Models;

namespace MovieGraphs.Data.Entities;

public class TemplateEntity
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public GraphTemplate Template { get; set; } = null!;

    public static void Configure(EntityTypeBuilder<TemplateEntity> builder)
    {
        builder.ToTable("templates");

        builder.Property(x => x.Id).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder
            .Property(x => x.Template)
            .HasColumnName("template")
            .HasConversion(
                x => JsonSerializer.Serialize(x, (JsonSerializerOptions?)null),
                x =>
                    JsonSerializer.Deserialize<GraphTemplate>(x, (JsonSerializerOptions?)null)
                    ?? GraphTemplate.Empty
            )
            .IsRequired();

        builder.HasKey(x => x.Id);
    }
}

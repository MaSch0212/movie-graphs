using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

/// <summary>An image scaled down to one of the widths the app requests, created on upload.</summary>
public class ImageVariantEntity
{
    public long ImageId { get; set; }
    public int Width { get; set; }
    public byte[] Data { get; set; } = null!;

    public ImageEntity Image { get; set; } = null!;

    public static void Configure(EntityTypeBuilder<ImageVariantEntity> builder)
    {
        builder.ToTable("image_variants");

        builder.Property(x => x.ImageId).HasColumnName("image_id").IsRequired();
        builder.Property(x => x.Width).HasColumnName("width").IsRequired();
        builder.Property(x => x.Data).HasColumnName("data").IsRequired();

        builder
            .HasOne(x => x.Image)
            .WithMany(x => x.Variants)
            .HasForeignKey(x => x.ImageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasKey(x => new { x.ImageId, x.Width });
    }
}

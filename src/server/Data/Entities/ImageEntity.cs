using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public class ImageEntity
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public byte[] Data { get; set; } = null!;
    public DateTimeOffset LastModified { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Whether the scaled down variants were created. Images stored before variants existed get
    /// them once on startup (see <see cref="Services.ImageVariantMigration"/>).
    /// </summary>
    public bool VariantsCreated { get; set; }

    public List<ImageVariantEntity> Variants { get; set; } = [];

    public static void Configure(EntityTypeBuilder<ImageEntity> builder)
    {
        builder.ToTable("images");

        builder.Property(x => x.Id).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Data).HasColumnName("data").IsRequired();
        builder
            .Property(x => x.LastModified)
            .HasColumnName("last_modified")
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(x => x.VariantsCreated).HasColumnName("variants_created").IsRequired();

        builder.HasKey(x => x.Id);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MovieGraphs.Data.Entities;

public class ImageEntity
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public byte[] Data { get; set; } = null!;
    public DateTimeOffset LastModified { get; set; } = DateTimeOffset.UtcNow;

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

        builder.HasKey(x => x.Id);
    }
}

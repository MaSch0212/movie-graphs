using MovieGraphs.Common;
using MovieGraphs.Data.Entities;
using SkiaSharp;

namespace MovieGraphs.Services;

[GenerateAutoInterface]
public class ImageResizeService : IImageResizeService
{
    /// <summary>The widths images are scaled down to when they are stored.</summary>
    public static readonly int[] AllowedWidths = [200, 400, 800];

    private const int JpegQuality = 82;

    /// <summary>
    /// Creates the scaled down variants of an image (keeping the aspect ratio), one for each
    /// allowed width that is smaller than the image. Images that can't be decoded (e.g. SVG)
    /// have none; the original is used for every width then.
    /// </summary>
    public List<ImageVariantEntity> CreateVariants(byte[] data)
    {
        var format = ImageDetector.GetImageFormat(data);
        if (
            format is not (ImageFormat.Jpg or ImageFormat.Png or ImageFormat.Bmp or ImageFormat.Gif)
        )
            return [];

        // Decoded once for all widths.
        using var original = SKBitmap.Decode(data);
        if (original is null)
            return [];

        // Keep transparency for formats that may have it, everything else becomes a JPEG.
        var encodedFormat = format is ImageFormat.Png or ImageFormat.Gif
            ? SKEncodedImageFormat.Png
            : SKEncodedImageFormat.Jpeg;

        var variants = new List<ImageVariantEntity>();
        foreach (var width in AllowedWidths.Where(width => width < original.Width))
        {
            var height = (int)Math.Round(original.Height * (width / (double)original.Width));
            using var resized = original.Resize(
                new SKImageInfo(width, height, original.ColorType, original.AlphaType),
                new SKSamplingOptions(SKCubicResampler.Mitchell)
            );
            using var encoded = resized?.Encode(encodedFormat, JpegQuality);
            if (encoded is not null)
                variants.Add(new ImageVariantEntity { Width = width, Data = encoded.ToArray() });
        }
        return variants;
    }
}

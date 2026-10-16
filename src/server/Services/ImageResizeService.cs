using Microsoft.Extensions.Caching.Memory;
using MovieGraphs.Common;
using SkiaSharp;

namespace MovieGraphs.Services;

[GenerateAutoInterface]
public class ImageResizeService(IMemoryCache cache) : IImageResizeService
{
    /// <summary>The widths images can be resized to. Limited to keep the cache small.</summary>
    public static readonly int[] AllowedWidths = [200, 400, 800];

    private const int JpegQuality = 82;

    /// <summary>
    /// Returns the image scaled down to the given width (keeping the aspect ratio). Images that
    /// are already small enough or can't be decoded (e.g. SVG) are returned unchanged.
    /// </summary>
    public byte[] Resize(long imageId, DateTimeOffset lastModified, byte[] data, int width)
    {
        return cache.GetOrCreate(
                (nameof(ImageResizeService), imageId, lastModified, width),
                entry =>
                {
                    var resized = ResizeCore(data, width);
                    entry.Size = resized.Length;
                    entry.SlidingExpiration = TimeSpan.FromHours(12);
                    return resized;
                }
            ) ?? data;
    }

    private static byte[] ResizeCore(byte[] data, int width)
    {
        var format = ImageDetector.GetImageFormat(data);
        if (
            format is not (ImageFormat.Jpg or ImageFormat.Png or ImageFormat.Bmp or ImageFormat.Gif)
        )
            return data;

        using var original = SKBitmap.Decode(data);
        if (original is null || original.Width <= width)
            return data;

        var height = (int)Math.Round(original.Height * (width / (double)original.Width));
        using var resized = original.Resize(
            new SKImageInfo(width, height, original.ColorType, original.AlphaType),
            new SKSamplingOptions(SKCubicResampler.Mitchell)
        );
        if (resized is null)
            return data;

        // Keep transparency for formats that may have it, everything else becomes a JPEG.
        var encodedFormat = format is ImageFormat.Png or ImageFormat.Gif
            ? SKEncodedImageFormat.Png
            : SKEncodedImageFormat.Jpeg;
        using var encoded = resized.Encode(encodedFormat, JpegQuality);
        return encoded?.ToArray() ?? data;
    }
}

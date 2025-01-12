namespace MovieGraphs.Common;

public enum ImageFormat
{
    Unknown = -1,
    Jpg,
    Bmp,
    Gif,
    Png,
    Svg,
    Tif
}

// https://www.c-sharpcorner.com/blogs/auto-detecting-image-type-and-extension-from-byte-in-c-sharp
public static class ImageDetector
{
    // some magic bytes for the most important image formats, see Wikipedia for more
    static readonly List<byte> jpg = [0xFF, 0xD8];
    static readonly List<byte> bmp = [0x42, 0x4D];
    static readonly List<byte> gif = [0x47, 0x49, 0x46];
    static readonly List<byte> png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    static readonly List<byte> svg_xml_small = [0x3C, 0x3F, 0x78, 0x6D, 0x6C]; // "<?xml"
    static readonly List<byte> svg_xml_capital = [0x3C, 0x3F, 0x58, 0x4D, 0x4C]; // "<?XML"
    static readonly List<byte> svg_small = [0x3C, 0x73, 0x76, 0x67]; // "<svg"
    static readonly List<byte> svg_capital = [0x3C, 0x53, 0x56, 0x47]; // "<SVG"
    static readonly List<byte> intel_tiff = [0x49, 0x49, 0x2A, 0x00];
    static readonly List<byte> motorola_tiff = [0x4D, 0x4D, 0x00, 0x2A];

    static readonly List<(List<byte> magic, ImageFormat format)> imageFormats =
    [
        (jpg, ImageFormat.Jpg),
        (bmp, ImageFormat.Bmp),
        (gif, ImageFormat.Gif),
        (png, ImageFormat.Png),
        (svg_small, ImageFormat.Svg),
        (svg_capital, ImageFormat.Svg),
        (intel_tiff, ImageFormat.Tif),
        (motorola_tiff, ImageFormat.Tif),
        (svg_xml_small, ImageFormat.Svg),
        (svg_xml_capital, ImageFormat.Svg)
    ];

    public static ImageFormat GetImageFormat(byte[] array)
    {
        // check for simple formats first
        foreach (var imageFormat in imageFormats)
        {
            if (array.IsImage(imageFormat.magic))
            {
                if (imageFormat.magic != svg_xml_small && imageFormat.magic != svg_xml_capital)
                    return imageFormat.format;

                // special handling for SVGs starting with XML tag
                int readCount = imageFormat.magic.Count; // skip XML tag
                int maxReadCount = 1024;

                do
                {
                    if (
                        array.IsImage(svg_small, readCount) || array.IsImage(svg_capital, readCount)
                    )
                    {
                        return ImageFormat.Svg;
                    }
                    readCount++;
                } while (readCount < maxReadCount && readCount < array.Length - 1);

                break;
            }
        }

        return ImageFormat.Unknown;
    }

    public static string GetContentType(this ImageFormat format)
    {
        return format switch
        {
            ImageFormat.Jpg => "image/jpeg",
            ImageFormat.Bmp => "image/bmp",
            ImageFormat.Gif => "image/gif",
            ImageFormat.Png => "image/png",
            ImageFormat.Svg => "image/svg+xml",
            ImageFormat.Tif => "image/tiff",
            _ => "application/octet-stream"
        };
    }

    public static string GetFileExtension(this ImageFormat format)
    {
        return format switch
        {
            ImageFormat.Jpg => ".jpg",
            ImageFormat.Bmp => ".bmp",
            ImageFormat.Gif => ".gif",
            ImageFormat.Png => ".png",
            ImageFormat.Svg => ".svg",
            ImageFormat.Tif => ".tif",
            _ => ".bin"
        };
    }

    private static bool IsImage(this byte[] array, List<byte> comparer, int offset = 0)
    {
        int arrayIndex = offset;
        foreach (byte c in comparer)
        {
            if (arrayIndex > array.Length - 1 || array[arrayIndex] != c)
                return false;
            ++arrayIndex;
        }
        return true;
    }
}

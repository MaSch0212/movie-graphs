using MovieGraphs.Common;

namespace MovieGraphs.Extensions;

public static class FormFileExtensions
{
    public static async Task<byte[]> GetBytesAsync(
        this IFormFile file,
        CancellationToken cancellationToken = default
    )
    {
        await using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream, cancellationToken);
        return memoryStream.ToArray();
    }
}

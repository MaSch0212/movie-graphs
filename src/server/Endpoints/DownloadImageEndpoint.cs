using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints;

/// <param name="ImageId">The id of the image.</param>
/// <param name="W">Optional width to scale the image down to (200, 400 or 800).</param>
public record DownloadImageRequest(
    [property: Required] string ImageId,
    [property: QueryParam] int? W
);

public class DownloadImageRequestValidator : Validator<DownloadImageRequest>
{
    public DownloadImageRequestValidator(IIdService idService)
    {
        RuleFor(x => x.ImageId).NotEmpty().ValidSqid(idService.Image);
        RuleFor(x => x.W)
            .Must(x => x is null || ImageResizeService.AllowedWidths.Contains(x.Value))
            .WithMessage(
                $"'w' must be one of: {string.Join(", ", ImageResizeService.AllowedWidths)}."
            );
    }
}

public class DownloadImageEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IImageResizeService imageResizeService
) : Endpoint<DownloadImageRequest>
{
    public override void Configure()
    {
        Get("images/{imageId}");
        AllowAnonymous();
        RoutePrefixOverride("");
        this.ProducesErrors(EndpointErrors.ImageNotFound);
    }

    public override async Task HandleAsync(DownloadImageRequest req, CancellationToken ct)
    {
        var imageId = idService.Image.DecodeSingle(req.ImageId);
        var image = await databaseContext
            .Images.Where(x => x.Id == imageId)
            .Select(x => new { x.Data, x.LastModified })
            .FirstOrDefaultAsync(ct);

        if (image == null)
        {
            Logger.LogWarning(EndpointErrors.ImageNotFound, imageId);
            await this.SendErrorAsync(EndpointErrors.ImageNotFound, req.ImageId, ct);
            return;
        }

        var data = req.W is { } width
            ? imageResizeService.Resize(imageId, image.LastModified, image.Data, width)
            : image.Data;
        var imageFormat = ImageDetector.GetImageFormat(data);
        await Send.BytesAsync(
            data,
            fileName: $"image-{req.ImageId}{imageFormat.GetFileExtension()}",
            contentType: imageFormat.GetContentType(),
            lastModified: image.LastModified,
            cancellation: ct
        );
    }
}

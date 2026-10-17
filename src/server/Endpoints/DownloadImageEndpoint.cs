using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints;

/// <param name="ImageId">The id of the image.</param>
/// <param name="W">Optional width of the scaled down image (200, 400 or 800).</param>
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

public class DownloadImageEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<DownloadImageRequest>
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
        // The variants are created when the image is stored. Images that are already small
        // enough (or can't be scaled, e.g. SVG) have none, so the original is sent instead.
        var width = req.W;
        var image = await databaseContext
            .Images.Where(x => x.Id == imageId)
            .Select(x => new
            {
                Data = x.Variants.Where(v => v.Width == width).Select(v => v.Data).FirstOrDefault()
                    ?? x.Data,
                x.LastModified,
            })
            .FirstOrDefaultAsync(ct);

        if (image == null)
        {
            Logger.LogWarning(EndpointErrors.ImageNotFound, imageId);
            await this.SendErrorAsync(EndpointErrors.ImageNotFound, req.ImageId, ct);
            return;
        }

        var imageFormat = ImageDetector.GetImageFormat(image.Data);
        await Send.BytesAsync(
            image.Data,
            fileName: $"image-{req.ImageId}{imageFormat.GetFileExtension()}",
            contentType: imageFormat.GetContentType(),
            lastModified: image.LastModified,
            cancellation: ct
        );
    }
}

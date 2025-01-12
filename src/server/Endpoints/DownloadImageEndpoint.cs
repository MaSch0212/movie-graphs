using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints;

public record DownloadImageRequest([property: Required] string ImageId);

public class DownloadImageRequestValidator : Validator<DownloadImageRequest>
{
    public DownloadImageRequestValidator(IIdService idService)
    {
        RuleFor(x => x.ImageId).NotEmpty().ValidSqid(idService.Image);
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

        var imageFormat = ImageDetector.GetImageFormat(image.Data);
        await SendBytesAsync(
            image.Data,
            fileName: $"image-{req.ImageId}{imageFormat.GetFileExtension()}",
            contentType: imageFormat.GetContentType(),
            lastModified: image.LastModified,
            cancellation: ct
        );
    }
}

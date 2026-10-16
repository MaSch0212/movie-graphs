using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Data.Entities;
using MovieGraphs.Mappers;
using MovieGraphs.Models;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="GraphNodeId">The id of the node to update.</param>
/// <param name="Name">The new name of the node.</param>
/// <param name="Image">The new image of the node.</param>
/// <param name="Status">The new watch status of the node.</param>
/// <param name="Duration">The new duration of the node.</param>
/// <param name="WhereToWatch">The new place where the node can be watched.</param>
public record UpdateGraphNodeRequest(
    [property: Required] string GraphNodeId,
    string? Name,
    IFormFile? Image,
    GraphNodeStatus? Status,
    TimeSpan? Duration,
    string? WhereToWatch
);

/// <param name="Node">The updated node.</param>
public record UpdateGraphNodeResponse([property: Required] GraphNode Node);

public class UpdateGraphNodeRequestValidator : Validator<UpdateGraphNodeRequest>
{
    public UpdateGraphNodeRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphNodeId).NotEmpty().ValidSqid(idService.GraphNode);
        RuleFor(x => x.Name)
            .Must(x => x == null || !string.IsNullOrWhiteSpace(x))
            .WithMessage("'Name' must not be empty.");
    }
}

public class UpdateGraphNodeEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IGraphMapper graphMapper
) : Endpoint<UpdateGraphNodeRequest, UpdateGraphNodeResponse>
{
    public override void Configure()
    {
        Patch("nodes/{graphNodeId}");
        AllowAnonymous();
        AllowFileUploads();
        Group<GraphsGroup>();
        this.ProducesErrors(
            EndpointErrors.GraphNodeNotFound,
            EndpointErrors.ImageTooLarge,
            EndpointErrors.ImageInvalidFormat
        );
    }

    public override async Task HandleAsync(UpdateGraphNodeRequest req, CancellationToken ct)
    {
        var graphNodeId = idService.GraphNode.DecodeSingle(req.GraphNodeId);
        var node = await databaseContext
            .Nodes.Include(x => x.Image)
            .FirstOrDefaultAsync(x => x.Id == graphNodeId, ct);
        if (node == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNodeNotFound, graphNodeId);
            await this.SendErrorAsync(EndpointErrors.GraphNodeNotFound, req.GraphNodeId, ct);
            return;
        }

        if (req.Name is not null)
        {
            node.Name = req.Name;
            node.Image.Name = req.Name;
        }
        if (req.Image is not null)
        {
            var imageData = await req.Image.GetBytesAsync(ct);
            if (ImageDetector.GetImageFormat(imageData) == ImageFormat.Unknown)
            {
                Logger.LogWarning(EndpointErrors.ImageInvalidFormat);
                await this.SendErrorAsync(EndpointErrors.ImageInvalidFormat, ct);
                return;
            }
            if (imageData.Length > 1024 * 1024)
            {
                Logger.LogWarning(EndpointErrors.ImageTooLarge);
                await this.SendErrorAsync(EndpointErrors.ImageTooLarge, ct);
                return;
            }

            node.Image.Data = imageData;
            node.Image.LastModified = DateTimeOffset.UtcNow;
        }
        if (req.Status is not null)
            node.Status = req.Status.Value;
        // A field that is sent with an empty value clears it.
        if (Form.TryGetValue("duration", out var duration))
            node.Duration = string.IsNullOrWhiteSpace(duration) ? null : req.Duration;
        if (Form.TryGetValue("whereToWatch", out var whereToWatch))
            node.WhereToWatch = string.IsNullOrWhiteSpace(whereToWatch) ? null : req.WhereToWatch;

        await databaseContext.SaveChangesAsync(ct);
        await Send.OkAsync(new(graphMapper.ToGraphNodeExpression.Compile()(node)), ct);
    }
}

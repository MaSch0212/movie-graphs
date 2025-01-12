using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Data.Entities;
using MovieGraphs.Models;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="GraphId">The id of the graph to add the node to.</param>
/// <param name="Name">The name of the node.</param>
/// <param name="Image">The image of the node.</param>
public record CreateGraphNodeRequest(
    [property: Required] string GraphId,
    [property: Required] string Name,
    [property: Required] IFormFile Image
);

/// <param name="Node">The created node.</param>
public record CreateGraphNodeResponse([property: Required] GraphNode Node);

public class CreateGraphNodeRequestValidator : Validator<CreateGraphNodeRequest>
{
    public CreateGraphNodeRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphId).NotEmpty().ValidSqid(idService.Graph);
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Image).NotEmpty();
    }
}

public class CreateGraphNodeEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<CreateGraphNodeRequest, CreateGraphNodeResponse>
{
    public override void Configure()
    {
        Post("{graphId}/nodes");
        AllowAnonymous();
        AllowFileUploads();
        Group<GraphsGroup>();
        this.ProducesErrors(
            EndpointErrors.GraphNotFound,
            EndpointErrors.ImageTooLarge,
            EndpointErrors.ImageInvalidFormat
        );
    }

    public override async Task HandleAsync(CreateGraphNodeRequest req, CancellationToken ct)
    {
        var graphId = idService.Graph.DecodeSingle(req.GraphId);
        var graphExists = await databaseContext.Graphs.AnyAsync(x => x.Id == graphId, ct);

        if (!graphExists)
        {
            Logger.LogWarning(EndpointErrors.GraphNotFound, graphId);
            await this.SendErrorAsync(EndpointErrors.GraphNotFound, req.GraphId, ct);
            return;
        }

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

        var node = new GraphNodeEntity
        {
            GraphId = graphId,
            Name = req.Name,
            Image = new ImageEntity { Name = req.Name, Data = imageData }
        };

        await databaseContext.Nodes.AddAsync(node, ct);
        await databaseContext.SaveChangesAsync(ct);

        await SendAsync(
            new(
                new(
                    idService.GraphNode.Encode(node.Id),
                    node.Name,
                    $"images/{idService.Image.Encode(node.ImageId)}",
                    node.Watched
                )
            ),
            cancellation: ct
        );
    }
}

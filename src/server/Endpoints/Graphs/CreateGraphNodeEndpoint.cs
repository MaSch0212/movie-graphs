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
/// <param name="Name">The title of the node, without year, season or episodes.</param>
/// <param name="ShortName">A shorter title for places with little space.</param>
/// <param name="Type">Whether the node is a movie or (a part of) a series (defaults to movie).</param>
/// <param name="Year">The year the node was released.</param>
/// <param name="Season">The season of a series.</param>
/// <param name="EpisodeFrom">The first episode of a series that belongs to the node.</param>
/// <param name="EpisodeTo">The last episode, if the node covers a range of episodes.</param>
/// <param name="Image">The image of the node.</param>
/// <param name="Status">The watch status of the node (defaults to unwatched).</param>
/// <param name="Duration">The duration of the node.</param>
/// <param name="WhereToWatch">Where the node can be watched.</param>
public record CreateGraphNodeRequest(
    [property: Required] string GraphId,
    [property: Required] string Name,
    string? ShortName,
    GraphNodeType? Type,
    int? Year,
    int? Season,
    int? EpisodeFrom,
    int? EpisodeTo,
    [property: Required] IFormFile Image,
    GraphNodeStatus? Status,
    TimeSpan? Duration,
    string? WhereToWatch
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
        RuleFor(x => x.ShortName).MaximumLength(255);
        RuleFor(x => x.Year).InclusiveBetween(1800, 2200);
        RuleFor(x => x.Season).InclusiveBetween(0, 1000);
        RuleFor(x => x.EpisodeFrom).InclusiveBetween(1, 10000);
        RuleFor(x => x.EpisodeTo)
            .Must((req, to) => to == null || (req.EpisodeFrom != null && to >= req.EpisodeFrom))
            .WithMessage("'Episode To' needs an 'Episode From' that is not greater.");
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

        var type = req.Type ?? GraphNodeType.Movie;
        var node = new GraphNodeEntity
        {
            GraphId = graphId,
            Name = req.Name,
            ShortName = string.IsNullOrWhiteSpace(req.ShortName) ? null : req.ShortName,
            Type = type,
            Year = req.Year,
            // Only series have seasons and episodes.
            Season = type == GraphNodeType.Series ? req.Season : null,
            EpisodeFrom = type == GraphNodeType.Series ? req.EpisodeFrom : null,
            EpisodeTo = type == GraphNodeType.Series ? req.EpisodeTo : null,
            Image = new ImageEntity { Name = req.Name, Data = imageData },
            Status = req.Status ?? GraphNodeStatus.Unwatched,
            Duration = req.Duration,
            WhereToWatch = string.IsNullOrWhiteSpace(req.WhereToWatch) ? null : req.WhereToWatch,
        };

        await databaseContext.Nodes.AddAsync(node, ct);
        await databaseContext.SaveChangesAsync(ct);

        await Send.OkAsync(
            new(
                new(
                    idService.GraphNode.Encode(node.Id),
                    node.Name,
                    node.ShortName,
                    node.Type,
                    node.Year,
                    node.Season,
                    node.EpisodeFrom,
                    node.EpisodeTo,
                    $"images/{idService.Image.Encode(node.ImageId)}",
                    node.Status,
                    node.Duration,
                    node.WhereToWatch
                )
            ),
            ct
        );
    }
}

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
/// <param name="Name">The new title of the node, without year, season or episodes.</param>
/// <param name="ShortName">A shorter title for places with little space.</param>
/// <param name="Type">Whether the node is a movie or (a part of) a series.</param>
/// <param name="Year">The year the node was released.</param>
/// <param name="Season">The season of a series.</param>
/// <param name="EpisodeFrom">The first episode of a series that belongs to the node.</param>
/// <param name="EpisodeTo">The last episode, if the node covers a range of episodes.</param>
/// <param name="Image">The new image of the node.</param>
/// <param name="Status">The new watch status of the node.</param>
/// <param name="Duration">The new duration of the node.</param>
/// <param name="WhereToWatch">The new place where the node can be watched.</param>
public record UpdateGraphNodeRequest(
    [property: Required] string GraphNodeId,
    string? Name,
    string? ShortName,
    GraphNodeType? Type,
    int? Year,
    int? Season,
    int? EpisodeFrom,
    int? EpisodeTo,
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
        RuleFor(x => x.ShortName).MaximumLength(255);
        // Year, season and episodes are checked in the endpoint: empty values (which clear them)
        // arrive as 0 here.
    }
}

public class UpdateGraphNodeEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IGraphMapper graphMapper,
    IImageResizeService imageResizeService
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

            // Only loaded when the image changes, the variants of the old image are deleted.
            await databaseContext.Entry(node.Image).Collection(x => x.Variants).LoadAsync(ct);
            node.Image.Data = imageData;
            node.Image.LastModified = DateTimeOffset.UtcNow;
            node.Image.Variants.Clear();
            node.Image.Variants.AddRange(imageResizeService.CreateVariants(imageData));
            node.Image.VariantsCreated = true;
        }
        if (req.Status is not null)
            node.Status = req.Status.Value;
        // A field that is sent with an empty value clears it.
        if (Form.TryGetValue("duration", out var duration))
            node.Duration = string.IsNullOrWhiteSpace(duration) ? null : req.Duration;
        if (Form.TryGetValue("whereToWatch", out var whereToWatch))
            node.WhereToWatch = string.IsNullOrWhiteSpace(whereToWatch) ? null : req.WhereToWatch;
        if (Form.TryGetValue("shortName", out var shortName))
            node.ShortName = string.IsNullOrWhiteSpace(shortName) ? null : req.ShortName;
        if (req.Type is not null)
            node.Type = req.Type.Value;
        if (Form.TryGetValue("year", out var year))
            node.Year = string.IsNullOrWhiteSpace(year) ? null : req.Year;
        if (Form.TryGetValue("season", out var season))
            node.Season = string.IsNullOrWhiteSpace(season) ? null : req.Season;
        if (Form.TryGetValue("episodeFrom", out var episodeFrom))
            node.EpisodeFrom = string.IsNullOrWhiteSpace(episodeFrom) ? null : req.EpisodeFrom;
        if (Form.TryGetValue("episodeTo", out var episodeTo))
            node.EpisodeTo = string.IsNullOrWhiteSpace(episodeTo) ? null : req.EpisodeTo;
        // Only series have seasons and episodes.
        if (node.Type == GraphNodeType.Movie)
        {
            node.Season = null;
            node.EpisodeFrom = null;
            node.EpisodeTo = null;
        }
        if (node.Year is < 1800 or > 2200)
            AddError(x => x.Year, "'Year' must be between 1800 and 2200.");
        if (node.Season is < 0 or > 1000)
            AddError(x => x.Season, "'Season' must be between 0 and 1000.");
        if (node.EpisodeFrom is < 1 or > 10000)
            AddError(x => x.EpisodeFrom, "'Episode From' must be between 1 and 10000.");
        if (
            node.EpisodeTo is not null
            && (node.EpisodeFrom is null || node.EpisodeTo < node.EpisodeFrom)
        )
            AddError(x => x.EpisodeTo, "'Episode To' needs an 'Episode From' that is not greater.");
        ThrowIfAnyErrors();

        await databaseContext.SaveChangesAsync(ct);
        await Send.OkAsync(new(graphMapper.ToGraphNodeExpression.Compile()(node)), ct);
    }
}

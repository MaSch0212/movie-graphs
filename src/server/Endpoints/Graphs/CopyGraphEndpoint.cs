using System.ComponentModel.DataAnnotations;
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

/// <param name="GraphId">The id of the graph to copy.</param>
/// <param name="Name">The name of the new graph.</param>
/// <param name="ResetStatus">Whether all titles of the copy start as unwatched.</param>
public record CopyGraphRequest(
    [property: Required] string GraphId,
    [property: Required] string Name,
    bool ResetStatus
);

/// <param name="Graph">The created copy of the graph.</param>
public record CopyGraphResponse([property: Required] Graph Graph);

public class CopyGraphRequestValidator : Validator<CopyGraphRequest>
{
    public CopyGraphRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphId).NotEmpty().ValidSqid(idService.Graph);
        RuleFor(x => x.Name).NotEmpty();
    }
}

public class CopyGraphEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IGraphMapper graphMapper
) : Endpoint<CopyGraphRequest, CopyGraphResponse>
{
    public override void Configure()
    {
        Post("{graphId}/copy");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphNotFound);
    }

    public override async Task HandleAsync(CopyGraphRequest req, CancellationToken ct)
    {
        var graphId = idService.Graph.DecodeSingle(req.GraphId);
        var source = await databaseContext
            .Graphs.AsNoTracking()
            .Include(x => x.Nodes)
                .ThenInclude(x => x.Image)
                    .ThenInclude(x => x.Variants)
            .Include(x => x.Nodes)
                .ThenInclude(x => x.OutgoingEdges)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == graphId, ct);
        if (source == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNotFound, graphId);
            await this.SendErrorAsync(EndpointErrors.GraphNotFound, req.GraphId, ct);
            return;
        }

        // Every node gets its own copy of the image, because deleting a node deletes its image.
        var copies = source.Nodes.ToDictionary(
            node => node.Id,
            node => new GraphNodeEntity
            {
                Name = node.Name,
                ShortName = node.ShortName,
                Type = node.Type,
                Year = node.Year,
                Season = node.Season,
                EpisodeFrom = node.EpisodeFrom,
                EpisodeTo = node.EpisodeTo,
                Image = new ImageEntity
                {
                    Name = node.Image.Name,
                    Data = node.Image.Data,
                    LastModified = node.Image.LastModified,
                    Variants =
                    [
                        .. node.Image.Variants.Select(variant => new ImageVariantEntity
                        {
                            Width = variant.Width,
                            Data = variant.Data,
                        }),
                    ],
                    VariantsCreated = node.Image.VariantsCreated,
                },
                Status = req.ResetStatus ? GraphNodeStatus.Unwatched : node.Status,
                Duration = node.Duration,
                WhereToWatch = node.WhereToWatch,
            }
        );
        foreach (var edge in source.Nodes.SelectMany(x => x.OutgoingEdges))
        {
            if (!copies.TryGetValue(edge.TargetNodeId, out var target))
                continue;
            copies[edge.SourceNodeId]
                .OutgoingEdges.Add(new GraphEdgeEntity { TargetNode = target });
        }

        var graph = new GraphEntity { Name = req.Name, Nodes = [.. copies.Values] };
        await databaseContext.Graphs.AddAsync(graph, ct);
        await databaseContext.SaveChangesAsync(ct);

        var result = await databaseContext
            .Graphs.Where(x => x.Id == graph.Id)
            .Select(graphMapper.ToGraphExpression)
            .FirstAsync(ct);
        await Send.OkAsync(new(result), ct);
    }
}

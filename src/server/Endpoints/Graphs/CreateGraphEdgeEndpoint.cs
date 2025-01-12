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

/// <param name="SourceNodeId">The id of the source node.</param>
/// <param name="TargetNodeId">The id of the target node.</param>
public record CreateGraphEdgeRequest(
    [property: Required] string SourceNodeId,
    [property: Required] string TargetNodeId
);

/// <param name="Edge">The edge that was created.</param>
public record CreateGraphEdgeResponse([property: Required] GraphEdge Edge);

public class CreateGraphEdgeRequestValidator : Validator<CreateGraphEdgeRequest>
{
    public CreateGraphEdgeRequestValidator(IIdService idService)
    {
        RuleFor(x => x.SourceNodeId).NotEmpty().ValidSqid(idService.GraphNode);
        RuleFor(x => x.TargetNodeId).NotEmpty().ValidSqid(idService.GraphNode);
    }
}

public class CreateGraphEdgeEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<CreateGraphEdgeRequest, CreateGraphEdgeResponse>
{
    public override void Configure()
    {
        Post("edges/{sourceNodeId}/{targetNodeId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(
            EndpointErrors.GraphNodesInDifferentGraphs,
            EndpointErrors.GraphNodeNotFound,
            EndpointErrors.GraphEdgeAlreadyExists
        );
    }

    public override async Task HandleAsync(CreateGraphEdgeRequest req, CancellationToken ct)
    {
        var sourceNodeId = idService.GraphNode.DecodeSingle(req.SourceNodeId);
        var sourceNode = await databaseContext
            .Nodes.Where(x => x.Id == sourceNodeId)
            .Select(x => new { x.GraphId })
            .FirstOrDefaultAsync(ct);
        if (sourceNode == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNodeNotFound, req.SourceNodeId);
            await this.SendErrorAsync(EndpointErrors.GraphNodeNotFound, req.SourceNodeId, ct);
            return;
        }

        var targetNodeId = idService.GraphNode.DecodeSingle(req.TargetNodeId);
        var targetNode = await databaseContext
            .Nodes.Where(x => x.Id == targetNodeId)
            .Select(x => new { x.GraphId })
            .FirstOrDefaultAsync(ct);
        if (targetNode == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNodeNotFound, req.TargetNodeId);
            await this.SendErrorAsync(EndpointErrors.GraphNodeNotFound, req.TargetNodeId, ct);
            return;
        }

        if (sourceNode.GraphId != targetNode.GraphId)
        {
            Logger.LogWarning(
                EndpointErrors.GraphNodesInDifferentGraphs,
                req.SourceNodeId,
                req.TargetNodeId
            );
            await this.SendErrorAsync(
                EndpointErrors.GraphNodesInDifferentGraphs,
                req.SourceNodeId,
                req.TargetNodeId,
                ct
            );
            return;
        }

        var edgeExists = await databaseContext.Edges.AnyAsync(
            x => x.SourceNodeId == sourceNodeId && x.TargetNodeId == targetNodeId,
            ct
        );
        if (edgeExists)
        {
            Logger.LogWarning(EndpointErrors.GraphEdgeAlreadyExists, sourceNodeId, targetNodeId);
            await this.SendErrorAsync(
                EndpointErrors.GraphEdgeAlreadyExists,
                req.SourceNodeId,
                req.TargetNodeId,
                ct
            );
            return;
        }

        var edge = new GraphEdgeEntity { SourceNodeId = sourceNodeId, TargetNodeId = targetNodeId };

        await databaseContext.Edges.AddAsync(edge, ct);
        await databaseContext.SaveChangesAsync(ct);

        await SendAsync(
            new(
                new(
                    idService.GraphNode.Encode(edge.SourceNodeId),
                    idService.GraphNode.Encode(edge.TargetNodeId)
                )
            ),
            cancellation: ct
        );
    }
}

using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="SourceNodeId">The ID of the source node of the edge to delete.</param>
/// <param name="TargetNodeId">The ID of the target node of the edge to delete.</param>
public record DeleteGraphEdgeRequest(
    [property: Required] string SourceNodeId,
    [property: Required] string TargetNodeId
);

public class DeleteGraphEdgeRequestValidator : Validator<DeleteGraphEdgeRequest>
{
    public DeleteGraphEdgeRequestValidator(IIdService idService)
    {
        RuleFor(x => x.SourceNodeId).NotEmpty().ValidSqid(idService.GraphNode);
        RuleFor(x => x.TargetNodeId).NotEmpty().ValidSqid(idService.GraphNode);
    }
}

public class DeleteGraphEdgeEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<DeleteGraphEdgeRequest>
{
    public override void Configure()
    {
        Delete("edges/{sourceNodeId}/{targetNodeId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphEdgeNotFound);
    }

    public override async Task HandleAsync(DeleteGraphEdgeRequest req, CancellationToken ct)
    {
        var sourceNodeId = idService.GraphNode.DecodeSingle(req.SourceNodeId);
        var targetNodeId = idService.GraphNode.DecodeSingle(req.TargetNodeId);
        var edgeQuery = databaseContext.Edges.Where(x =>
            x.SourceNodeId == sourceNodeId && x.TargetNodeId == targetNodeId
        );
        var edgeExists = await edgeQuery.AnyAsync(ct);
        if (!edgeExists)
        {
            Logger.LogWarning(EndpointErrors.GraphEdgeNotFound, sourceNodeId, targetNodeId);
            await this.SendErrorAsync(
                EndpointErrors.GraphEdgeNotFound,
                req.SourceNodeId,
                req.TargetNodeId,
                ct
            );
            return;
        }

        await edgeQuery.ExecuteDeleteAsync(ct);

        await SendNoContentAsync(cancellation: ct);
    }
}

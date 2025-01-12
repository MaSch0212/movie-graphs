using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="GraphNodeId">The ID of the graph node to delete.</param>
public record DeleteGraphNodeRequest([property: Required] string GraphNodeId);

public class DeleteGraphNodeRequestValidator : Validator<DeleteGraphNodeRequest>
{
    public DeleteGraphNodeRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphNodeId).NotEmpty().ValidSqid(idService.GraphNode);
    }
}

public class DeleteGraphNodeEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<DeleteGraphNodeRequest>
{
    public override void Configure()
    {
        Delete("nodes/{graphNodeId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphNodeNotFound);
    }

    public override async Task HandleAsync(DeleteGraphNodeRequest req, CancellationToken ct)
    {
        var graphNodeId = idService.GraphNode.DecodeSingle(req.GraphNodeId);
        var nodeQuery = databaseContext.Nodes.Where(x => x.Id == graphNodeId);
        var nodeInfo = await nodeQuery.Select(x => new { x.ImageId }).FirstOrDefaultAsync(ct);
        if (nodeInfo == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNodeNotFound, graphNodeId);
            await this.SendErrorAsync(EndpointErrors.GraphNodeNotFound, req.GraphNodeId, ct);
            return;
        }

        await nodeQuery.ExecuteDeleteAsync(ct);
        await databaseContext.Images.Where(x => x.Id == nodeInfo.ImageId).ExecuteDeleteAsync(ct);

        await SendNoContentAsync(cancellation: ct);
    }
}

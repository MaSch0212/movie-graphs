using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="GraphId">The ID of the graph to delete.</param>
public record DeleteGraphRequest([property: Required] string GraphId);

public class DeleteGraphRequestValidator : Validator<DeleteGraphRequest>
{
    public DeleteGraphRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphId).NotEmpty().ValidSqid(idService.Graph);
    }
}

public class DeleteGraphEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<DeleteGraphRequest>
{
    public override void Configure()
    {
        Delete("{graphId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphNotFound);
    }

    public override async Task HandleAsync(DeleteGraphRequest req, CancellationToken ct)
    {
        var graphId = idService.Graph.DecodeSingle(req.GraphId);
        var graphQuery = databaseContext.Graphs.Where(x => x.Id == graphId);
        var graphExists = await graphQuery.AnyAsync(ct);
        if (!graphExists)
        {
            Logger.LogWarning(EndpointErrors.GraphNotFound, graphId);
            await this.SendErrorAsync(EndpointErrors.GraphNotFound, req.GraphId, ct);
            return;
        }

        await graphQuery.ExecuteDeleteAsync(ct);

        await SendNoContentAsync(cancellation: ct);
    }
}

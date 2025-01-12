using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MovieGraphs.Common;
using MovieGraphs.Data;
using MovieGraphs.Mappers;
using MovieGraphs.Models;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="GraphId">The id of the graph to retrieve.</param>
public record GetGraphRequest([property: Required] string GraphId);

/// <param name="Graph">The graph that was retrieved.</param>
public record GetGraphResponse([property: Required] Graph Graph);

public class GetGraphRequestValidator : Validator<GetGraphRequest>
{
    public GetGraphRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphId).NotEmpty().ValidSqid(idService.Graph);
    }
}

public class GetGraphEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IGraphMapper graphMapper
) : Endpoint<GetGraphRequest, GetGraphResponse>
{
    public override void Configure()
    {
        Get("{graphId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphNotFound);
    }

    public override async Task HandleAsync(GetGraphRequest req, CancellationToken ct)
    {
        var graphId = idService.Graph.DecodeSingle(req.GraphId);
        var graph = await databaseContext
            .Graphs.Where(x => x.Id == graphId)
            .Select(graphMapper.ToGraphExpression)
            .FirstOrDefaultAsync(ct);

        if (graph == null)
        {
            Logger.LogWarning(EndpointErrors.GraphNotFound, graphId);
            await this.SendErrorAsync(EndpointErrors.GraphNotFound, req.GraphId, ct);
            return;
        }

        await SendAsync(new(graph), cancellation: ct);
    }
}

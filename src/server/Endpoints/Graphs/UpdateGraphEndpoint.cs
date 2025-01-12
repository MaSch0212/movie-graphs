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

/// <param name="GraphId">The ID of the graph.</param>
/// <param name="Name">The new name of the graph.</param>
public record UpdateGraphRequest([property: Required] string GraphId, string? Name);

/// <param name="Graph">The updated graph.</param>
public record UpdateGraphResponse([property: Required] Graph Graph);

public class UpdateGraphRequestValidator : Validator<UpdateGraphRequest>
{
    public UpdateGraphRequestValidator(IIdService idService)
    {
        RuleFor(x => x.GraphId).NotEmpty().ValidSqid(idService.Graph);
        RuleFor(x => x.Name)
            .Must(x => x == null || !string.IsNullOrWhiteSpace(x))
            .WithMessage("'Name' must not be empty.");
    }
}

public class UpdateGraphEndpoint(
    DatabaseContext databaseContext,
    IIdService idService,
    IGraphMapper graphMapper
) : Endpoint<UpdateGraphRequest, UpdateGraphResponse>
{
    public override void Configure()
    {
        Patch("{graphId}");
        AllowAnonymous();
        Group<GraphsGroup>();
        this.ProducesErrors(EndpointErrors.GraphNotFound);
    }

    public override async Task HandleAsync(UpdateGraphRequest req, CancellationToken ct)
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

        var updater = DbUpdateBuilder.Create(graphQuery);
        if (req.Name is not null)
            updater.With(x => x.SetProperty(x => x.Name, req.Name));
        await updater.ExecuteAsync(ct);

        await SendAsync(
            new(await graphQuery.Select(graphMapper.ToGraphExpression).FirstAsync(ct)),
            cancellation: ct
        );
    }
}

using System.ComponentModel.DataAnnotations;
using FastEndpoints;
using FluentValidation;
using MovieGraphs.Data;
using MovieGraphs.Data.Entities;
using MovieGraphs.Models;
using MovieGraphs.Services;

namespace MovieGraphs.Endpoints.Graphs;

/// <param name="Name">The name of the graph.</param>
public record CreateGraphRequest([property: Required] string Name);

/// <param name="Graph">The created graph.</param>
public record CreateGraphResponse(Graph Graph);

public class CreateGraphRequestValidator : Validator<CreateGraphRequest>
{
    public CreateGraphRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
    }
}

public class CreateGraphEndpoint(DatabaseContext databaseContext, IIdService idService)
    : Endpoint<CreateGraphRequest, CreateGraphResponse>
{
    public override void Configure()
    {
        Post("");
        AllowAnonymous();
        Group<GraphsGroup>();
    }

    public override async Task HandleAsync(CreateGraphRequest req, CancellationToken ct)
    {
        var graph = new GraphEntity { Name = req.Name };

        await databaseContext.Graphs.AddAsync(graph, ct);
        await databaseContext.SaveChangesAsync(ct);

        await SendAsync(
            new(new(idService.Graph.Encode(graph.Id), graph.Name, [], [])),
            cancellation: ct
        );
    }
}

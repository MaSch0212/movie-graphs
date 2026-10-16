using System.ComponentModel.DataAnnotations;
using MovieGraphs.Data.Entities;

namespace MovieGraphs.Models;

public record Graph(
    [property: Required] string Id,
    [property: Required] string Name,
    [property: Required] GraphNode[] Nodes,
    [property: Required] GraphEdge[] Edges
);

/// <param name="Id">The id of the node.</param>
/// <param name="Name">The title, without year, season or episodes.</param>
/// <param name="ShortName">A shorter title for places with little space.</param>
/// <param name="Type">Whether the node is a movie or (a part of) a series.</param>
/// <param name="Year">The year the node was released.</param>
/// <param name="Season">The season of a series.</param>
/// <param name="EpisodeFrom">The first episode of a series that belongs to the node.</param>
/// <param name="EpisodeTo">The last episode, if the node covers a range of episodes.</param>
/// <param name="ImageUrl">The URL of the poster image.</param>
/// <param name="Status">The watch status of the node.</param>
/// <param name="Duration">The runtime of the node.</param>
/// <param name="WhereToWatch">Where the node can be watched.</param>
public record GraphNode(
    [property: Required] string Id,
    [property: Required] string Name,
    string? ShortName,
    [property: Required] GraphNodeType Type,
    int? Year,
    int? Season,
    int? EpisodeFrom,
    int? EpisodeTo,
    [property: Required] string ImageUrl,
    [property: Required] GraphNodeStatus Status,
    TimeSpan? Duration,
    string? WhereToWatch
);

public record GraphEdge(
    [property: Required] string SourceNodeId,
    [property: Required] string TargetNodeId
);

using System.ComponentModel.DataAnnotations;

namespace MovieGraphs.Models;

public record Graph(
    [property: Required] string Id,
    [property: Required] string Name,
    [property: Required] GraphNode[] Nodes,
    [property: Required] GraphEdge[] Edges
);

public record GraphNode(
    [property: Required] string Id,
    [property: Required] string Name,
    [property: Required] string ImageUrl,
    [property: Required] bool Watched
);

public record GraphEdge(
    [property: Required] string SourceNodeId,
    [property: Required] string TargetNodeId
);

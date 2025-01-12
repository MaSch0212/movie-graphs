using MovieGraphs.Common;

namespace MovieGraphs.Endpoints;

public static class EndpointErrors
{
    public static readonly EndpointError.Params1 GraphNotFound =
        new(404, "A graph with the id {0} does not exist.", "GraphId");
    public static readonly EndpointError.Params1 GraphNodeNotFound =
        new(404, "A node with the id {0} does not exist.", "NodeId");
    public static readonly EndpointError.Params2 GraphNodesInDifferentGraphs =
        new(
            400,
            "The nodes with the ids {0} and {1} are in different graphs.",
            "NodeId1",
            "NodeId2"
        );

    public static readonly EndpointError.Params2 GraphEdgeAlreadyExists =
        new(409, "The edge from node {0} to {1} already exists.", "SourceNodeId", "TargetNodeId");
    public static readonly EndpointError.Params2 GraphEdgeNotFound =
        new(404, "An edge from node {0} to {1} does not exist.", "SourceNodeId", "TargetNodeId");

    public static readonly EndpointError.Params1 ImageNotFound =
        new(404, "An image with the id {0} does not exist.", "ImageId");
    public static readonly EndpointError ImageTooLarge =
        new(413, "The image must be at most 1 MB.");
    public static readonly EndpointError ImageInvalidFormat =
        new(
            400,
            "The image must be one of the following file types: JPEG, BMP, GIF, PNG, SVG, TIF"
        );
}

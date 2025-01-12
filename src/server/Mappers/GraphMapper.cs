using System.Linq.Expressions;
using MovieGraphs.Data.Entities;
using MovieGraphs.Models;
using MovieGraphs.Services;

namespace MovieGraphs.Mappers;

[GenerateAutoInterface]
public class GraphMapper(IHttpContextAccessor httpContextAccessor, IIdService idService)
    : IGraphMapper
{
    public Expression<Func<GraphEntity, Graph>> ToGraphExpression { get; } =
        g => new Graph(
            idService.Graph.Encode(g.Id),
            g.Name,
            g.Nodes.Select(n => new GraphNode(
                    idService.GraphNode.Encode(n.Id),
                    n.Name,
                    GetImageUrl(httpContextAccessor, idService, n.ImageId),
                    n.Watched
                ))
                .ToArray(),
            g.Nodes.SelectMany(n => n.OutgoingEdges)
                .Select(e => new GraphEdge(
                    idService.GraphNode.Encode(e.SourceNodeId),
                    idService.GraphNode.Encode(e.TargetNodeId)
                ))
                .ToArray()
        );

    public Expression<Func<GraphNodeEntity, GraphNode>> ToGraphNodeExpression { get; } =
        n => new GraphNode(
            idService.GraphNode.Encode(n.Id),
            n.Name,
            GetImageUrl(httpContextAccessor, idService, n.ImageId),
            n.Watched
        );

    private static string GetImageUrl(
        IHttpContextAccessor httpContextAccessor,
        IIdService idService,
        long imageId
    )
    {
        var ctx = httpContextAccessor.HttpContext;
        var baseUrl = ctx is null
            ? ""
            : $"{ctx.Request.Scheme}://{ctx.Request.Host}/{ctx.Request.PathBase}";
        return $"{baseUrl}images/{idService.Image.Encode(imageId)}";
    }
}

namespace MovieGraphs.Models;

public record GraphTemplate(string Name, NodeTemplate[] Nodes, EdgeTemplate[] Edges)
{
    public static readonly GraphTemplate Empty = new("empty", [], []);
}

public record NodeTemplate(string Name, byte[] Image);

public record EdgeTemplate(int SourceNodeIndex, int TargetNodeIndex);

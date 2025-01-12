using FastEndpoints;

namespace MovieGraphs.Endpoints.Graphs;

public class GraphsGroup : Group
{
    public GraphsGroup()
    {
        Configure(
            "graphs",
            x =>
            {
                x.Description(x => x.WithTags("Graphs"));
            }
        );
    }
}

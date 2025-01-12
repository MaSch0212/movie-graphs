using System.Text.RegularExpressions;

namespace MovieGraphs;

public partial class RegularExpressions
{
    [GeneratedRegex("(?<=\\{)[^\\}]+(?=\\})")]
    public static partial Regex RouteParams();
}

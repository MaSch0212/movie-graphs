namespace MovieGraphs.Options;

public class AdminOptions : IOptionsWithSection
{
    public static string SectionPath => "Admin";
    public static Type? ValidatorType => null;

    public string? Username { get; set; }
    public string? Password { get; set; }
}

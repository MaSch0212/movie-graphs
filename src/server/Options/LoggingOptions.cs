namespace MovieGraphs.Options;

public class LoggingOptions : IOptionsWithSection
{
    public static string SectionPath => "Logging";
    public static Type? ValidatorType => null;

    public bool EnableDbLogging { get; set; } = false;

    /// <summary>Writes the id and name of every graph to the log on startup.</summary>
    public bool ListGraphsOnStartup { get; set; } = false;
}

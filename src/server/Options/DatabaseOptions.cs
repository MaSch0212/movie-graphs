using Microsoft.Extensions.Options;

namespace MovieGraphs.Options;

public class DatabaseOptions : IOptionsWithSection
{
    public static string SectionPath => "Database";
    public static Type? ValidatorType => typeof(DatabaseOptionsValidator);

    public bool SkipMigration { get; set; } = false;
    public string ConnectionString { get; set; } = null!;
}

public class DatabaseOptionsValidator : IValidateOptions<DatabaseOptions>
{
    public ValidateOptionsResult Validate(string? name, DatabaseOptions options)
    {
        if (string.IsNullOrEmpty(options.ConnectionString))
            return ValidateOptionsResult.Fail("Database:ConnectionString must be set");
        return ValidateOptionsResult.Success;
    }
}

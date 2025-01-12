using Microsoft.Extensions.Options;

namespace MovieGraphs.Options;

public class IdOptions : IOptionsWithSection
{
    public static string SectionPath => "Ids";
    public static Type? ValidatorType => typeof(IdOptionsValidator);

    public string Seed { get; set; } = null!;
}

public class IdOptionsValidator : IValidateOptions<IdOptions>
{
    public ValidateOptionsResult Validate(string? name, IdOptions options)
    {
        if (string.IsNullOrEmpty(options.Seed))
            return ValidateOptionsResult.Fail("Ids:Seed must be set");
        return ValidateOptionsResult.Success;
    }
}

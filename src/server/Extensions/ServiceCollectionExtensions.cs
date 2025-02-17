using Microsoft.Extensions.Options;
using MovieGraphs.Options;

namespace MovieGraphs.Extensions;

public static class ServiceCollectionExtensions
{
    public static OptionsBuilder<TOptions> AddAndBindOptions<TOptions>(
        this IServiceCollection services
    )
        where TOptions : class, IOptionsWithSection
    {
        var validatorType = TOptions.ValidatorType;
        var optionsBuilder = services
            .AddOptions<TOptions>()
            .BindConfiguration(TOptions.SectionPath);
        if (validatorType is not null)
        {
            services.AddSingleton(typeof(IValidateOptions<TOptions>), validatorType);
            optionsBuilder = optionsBuilder.ValidateOnStart();
        }

        return optionsBuilder;
    }
}

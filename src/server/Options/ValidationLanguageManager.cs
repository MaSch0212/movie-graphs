using FluentValidation.Resources;

namespace MovieGraphs.Options;

public class ValidationLanguageManager : LanguageManager
{
    public ValidationLanguageManager()
    {
        AddTranslation("en", "NotNullValidator", "'{PropertyName}' is required.");
    }
}

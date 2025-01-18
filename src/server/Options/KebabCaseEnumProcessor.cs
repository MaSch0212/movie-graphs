using NSwag.Generation.Processors;
using NSwag.Generation.Processors.Contexts;

namespace MovieGraphs.Options;

public class KebabCaseEnumProcessor : IDocumentProcessor
{
    public void Process(DocumentProcessorContext context)
    {
        foreach (var schema in context.Document.Definitions.Values)
        {
            if (!schema.IsEnumeration)
                continue;
            var enumNames = schema.Enumeration.Cast<string>().ToList();
            schema.Enumeration.Clear();
            foreach (var enumName in enumNames)
            {
                schema.Enumeration.Add(enumName.ToKebabCase());
            }
        }
    }
}

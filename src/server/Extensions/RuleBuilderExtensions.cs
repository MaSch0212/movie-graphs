using System.Numerics;
using FluentValidation;
using MovieGraphs.Common;
using Sqids;

namespace MovieGraphs.Extensions;

public static class RuleBuilderExtendsions
{
    public static IRuleBuilder<T, string> ValidSqid<T, TId>(
        this IRuleBuilder<T, string> ruleBuilder,
        SqidsEncoder<TId> sqidsEncoder
    )
        where TId : unmanaged, IBinaryInteger<TId>, IMinMaxValue<TId>
    {
        return ruleBuilder.Must(x => sqidsEncoder.Decode(x).Count == 1).WithMessage("Invalid ID");
    }

    public static IRuleBuilder<T, byte[]> IsImage<T>(this IRuleBuilder<T, byte[]> ruleBuilder)
    {
        return ruleBuilder.Custom(
            (image, context) =>
            {
                if (ImageDetector.GetImageFormat(image) == ImageFormat.Unknown)
                    context.AddFailure(
                        "Image",
                        "The image must be one of the following file types: JPEG, BMP, GIF, PNG, SVG, TIF"
                    );
                if (image.Length > 1024 * 1024)
                    context.AddFailure("Image", "The image must be at most 1 MB.");
            }
        );
    }
}

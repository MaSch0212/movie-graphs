using System.Numerics;
using FluentValidation;
using Sqids;

namespace MovieGraphs.Extensions;

public static class SqidsExtensions
{
    public static T DecodeSingle<T>(this SqidsEncoder<T> sqidsEncoder, ReadOnlySpan<char> id)
        where T : unmanaged, IBinaryInteger<T>, IMinMaxValue<T>
    {
        return sqidsEncoder.Decode(id).Single();
    }

    public static bool TryDecodeSingle<T>(
        this SqidsEncoder<T> sqidsEncoder,
        ReadOnlySpan<char> id,
        out T value
    )
        where T : unmanaged, IBinaryInteger<T>, IMinMaxValue<T>
    {
        var decoded = sqidsEncoder.Decode(id);
        if (decoded.Count == 1)
        {
            value = decoded.Single();
            return true;
        }
        value = default;
        return false;
    }
}

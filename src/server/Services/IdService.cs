using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using MovieGraphs.Options;
using Sqids;

namespace MovieGraphs.Services;

[GenerateAutoInterface]
public class IdService : IIdService
{
    private const string ALPHABET =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    public SqidsEncoder<long> Graph { get; }
    public SqidsEncoder<long> GraphNode { get; }
    public SqidsEncoder<long> Image { get; }
    public SqidsEncoder<long> Template { get; }

    public IdService(IOptions<IdOptions> idOptions)
    {
        var seed = BitConverter.ToInt32(
            SHA1.HashData(Encoding.UTF8.GetBytes(idOptions.Value.Seed))
        );
        var rng = new Random(seed.GetHashCode());

        Graph = GetIdEncoder(rng);
        GraphNode = GetIdEncoder(rng);
        Image = GetIdEncoder(rng);
        Template = GetIdEncoder(rng);
    }

    private static SqidsEncoder<long> GetIdEncoder(Random rng)
    {
        var chars = ALPHABET.ToCharArray();
        rng.Shuffle(chars);
        return new SqidsEncoder<long>(new() { Alphabet = new(chars), MinLength = 8 });
    }
}

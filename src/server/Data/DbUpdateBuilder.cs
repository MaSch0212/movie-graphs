using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;

namespace MovieGraphs.Data;

public static class DbUpdateBuilder
{
    public static DbUpdateBuilder<T> Create<T>(IQueryable<T> query)
    {
        return new DbUpdateBuilder<T>(query);
    }
}

public class DbUpdateBuilder<T>(IQueryable<T> query)
{
    private readonly List<Action<UpdateSettersBuilder<T>>> _setters = [];

    public DbUpdateBuilder<T> With(Action<UpdateSettersBuilder<T>> setter)
    {
        _setters.Add(setter);
        return this;
    }

    public async Task<int> ExecuteAsync(CancellationToken cancellation = default)
    {
        if (_setters.Count == 0)
            return 0;

        return await query.ExecuteUpdateAsync(
            builder =>
            {
                foreach (var setter in _setters)
                    setter(builder);
            },
            cancellation
        );
    }
}

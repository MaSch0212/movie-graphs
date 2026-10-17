using MovieGraphs.Data;

namespace MovieGraphs.Services;

/// <summary>
/// Creates the scaled down variants for images that were stored before variants existed. Runs
/// once after the database migrations; later images get their variants when they are stored.
/// </summary>
public static class ImageVariantMigration
{
    public static void Run(
        DatabaseContext databaseContext,
        IImageResizeService imageResizeService,
        ILogger logger
    )
    {
        var imageIds = databaseContext
            .Images.Where(x => !x.VariantsCreated)
            .Select(x => x.Id)
            .ToList();
        if (imageIds.Count == 0)
            return;

        logger.LogInformation(
            "Creating the scaled down variants of {Count} images...",
            imageIds.Count
        );
        foreach (var imageId in imageIds)
        {
            // One by one, so only one image is in memory at a time. The variants are saved together
            // with the flag, so an image never has some of them already.
            var image = databaseContext.Images.Single(x => x.Id == imageId);
            image.Variants.AddRange(imageResizeService.CreateVariants(image.Data));
            image.VariantsCreated = true;
            databaseContext.SaveChanges();
            databaseContext.ChangeTracker.Clear();
        }
        logger.LogInformation(
            "Created the scaled down variants of {Count} images.",
            imageIds.Count
        );
    }
}

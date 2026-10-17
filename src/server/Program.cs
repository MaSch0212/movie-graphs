using FastEndpoints;
using FastEndpoints.Swagger;
using FluentValidation;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MovieGraphs.Data;
using MovieGraphs.Mappers;
using MovieGraphs.Middlewares;
using MovieGraphs.Options;
using MovieGraphs.Services;
using NSwag;
using NSwag.Generation.AspNetCore;

ValidatorOptions.Global.LanguageManager = new ValidationLanguageManager();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAndBindOptions<AdminOptions>();
builder.Services.AddAndBindOptions<IdOptions>();
builder.Services.AddAndBindOptions<DatabaseOptions>();
builder.Services.AddAndBindOptions<LoggingOptions>();

var configureJsonSerializerOptions = new ConfigureJsonSerializerOptions();
builder.Services.ConfigureOptions(configureJsonSerializerOptions);

builder.Services.AddSingleton<IIdService, IdService>();
builder.Services.AddSingleton<IImageResizeService, ImageResizeService>();

builder.Services.AddScoped<IGraphMapper, GraphMapper>();

builder.Services.AddDbContext<DatabaseContext>();
builder.Services.AddHttpClient();

builder.Services.AddHealthChecks().AddDbContextCheck<DatabaseContext>();
IEnumerable<Type> endpointTypes = MovieGraphs.DiscoveredTypes.All;
if (Environment.GetEnvironmentVariable("ENABLE_DEV_ENDPOINTS") != "true")
    endpointTypes = endpointTypes.Where(x => !x.FullName!.Contains(".Dev."));
builder.Services.AddFastEndpoints([.. endpointTypes]);
builder.Services.AddEndpointsApiExplorer();
builder.Services.SwaggerDocument(c =>
{
    c.DocumentSettings = d =>
    {
        d.OperationProcessors.Add(new OperationIdProcessor());
        d.DocumentProcessors.Add(new KebabCaseEnumProcessor());
    };
    c.EnableJWTBearerAuth = false;
    c.ShortSchemaNames = true;
    c.AutoTagPathSegmentIndex = 0;
    c.SerializerSettings = configureJsonSerializerOptions.Configure;
    c.RemoveEmptyRequestSchema = true;
});

// Runs behind a reverse proxy that terminates HTTPS, so URLs built from the request (e.g. the
// image URLs) need the scheme the browser used. The proxy's address is not known in advance.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
builder.Services.AddSpaStaticFiles(options =>
{
    options.RootPath = "wwwroot";
});

var app = builder.Build();

app.UseForwardedHeaders();

// In development, plain HTTP stays usable for testing on other devices in the network: they
// don't trust the development certificate (e.g. iOS can't load the home screen icon over it).
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseResponseCompression();

app.UsePathBaseResolver();

app.UseStaticFiles();

if (!app.Environment.IsDevelopment())
{
    app.UseHtmlBaseTagInjector();
    app.UseSpaStaticFiles();
}

app.UseRouting();

app.MapHealthChecks("/healthz");
app.UseFastEndpoints(new ConfigureFastEndpointsConfig(configureJsonSerializerOptions).Configure)
    .UseSwaggerGen();

app.UseEndpoints(x => { });
app.UseSpa(spa =>
{
    spa.Options.SourcePath = "../";
    if (app.Environment.IsDevelopment())
    {
        spa.UseProxyToSpaDevelopmentServer("https://localhost:4200");
    }
});

var openApiOutput = app.Configuration.GetValue<string>("OpenApiOutput");
if (openApiOutput != null)
{
    using var scope = app.Services.CreateScope();
    Console.WriteLine("Generating OpenAPI...");
    var options = scope.ServiceProvider.GetRequiredService<
        IOptions<AspNetCoreOpenApiDocumentGeneratorSettings>
    >();
    var documentProvider =
        scope.ServiceProvider.GetRequiredService<NSwag.Generation.IOpenApiDocumentGenerator>();
    var apidoc = await documentProvider.GenerateAsync(options.Value.DocumentName);
    var targetPath = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), openApiOutput));
    Console.WriteLine($"Writing OpenAPI to \"{targetPath}\"...");
    File.WriteAllText(openApiOutput, apidoc.ToYaml());
    Console.WriteLine("Done");
    return;
}

using (var scope = app.Services.CreateScope())
{
    var databaseOptions = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>();
    if (!databaseOptions.Value.SkipMigration)
    {
        using var dbContext = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
        dbContext.Database.Migrate();
        ImageVariantMigration.Run(
            dbContext,
            scope.ServiceProvider.GetRequiredService<IImageResizeService>(),
            app.Logger
        );
    }
}

if (app.Services.GetRequiredService<IOptions<LoggingOptions>>().Value.ListGraphsOnStartup)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
    var idService = scope.ServiceProvider.GetRequiredService<IIdService>();
    foreach (var graph in dbContext.Graphs.AsNoTracking().OrderBy(x => x.Id))
    {
        app.Logger.LogInformation(
            "Graph {GraphId} ({Id}): {Name}",
            idService.Graph.Encode(graph.Id),
            graph.Id,
            graph.Name
        );
    }
}

app.Run();

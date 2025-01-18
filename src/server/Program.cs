using FastEndpoints;
using FastEndpoints.Swagger;
using FluentValidation;
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

builder.Services.AddScoped<IGraphMapper, GraphMapper>();

builder.Services.AddDbContext<DatabaseContext>();
builder.Services.AddHttpClient();

builder.Services.AddHealthChecks().AddDbContextCheck<DatabaseContext>();
builder.Services.AddFastEndpoints(o =>
{
    IEnumerable<Type> endpointTypes = MovieGraphs.DiscoveredTypes.All;
    if (Environment.GetEnvironmentVariable("ENABLE_DEV_ENDPOINTS") != "true")
        endpointTypes = endpointTypes.Where(x => !x.FullName!.Contains(".Dev."));
    o.SourceGeneratorDiscoveredTypes.AddRange(endpointTypes);
});
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

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
builder.Services.AddSpaStaticFiles(options =>
{
    options.RootPath = "wwwroot";
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseResponseCompression();

app.UsePathBaseResolver();
app.UseForwardedHeaders();

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
    }
}

// DEBUG
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<DatabaseContext>();
    var idService = scope.ServiceProvider.GetRequiredService<IIdService>();
    dbContext
        .Graphs.ForEachAsync(g =>
            Console.WriteLine($"Graph {idService.Graph.Encode(g.Id)} ({g.Id}): {g.Name}")
        )
        .Wait();
}

app.Run();

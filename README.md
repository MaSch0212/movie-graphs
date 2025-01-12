# MovieGraphs

## Run in Docker

The docker container is available in Docker Hub as [masch0212/movie-graphs:latest](https://hub.docker.com/r/masch0212/movie-graphs).

### Example

This exaple hosts the application on port 8080 and uses the `/path/to/your/data` directory to store the data.

```bash
docker run -d \
    -e IDS__SEED=<RandomSeed> \
    -v /path/to/your/data:/app/data \
    -p 8080:80 \
    masch0212/movie-graphs:latest
```

### Environment Variables

| Variable                     | Description                                    | Required | Default                           |
| ---------------------------- | ---------------------------------------------- | -------- | --------------------------------- |
| `IDS__SEED`                  | The seed for the id obfuscation.               | Yes      | -                                 |
| `LOGGING__ENABLEDBLOGGING`   | Enable database logging.                       | No       | `false`                           |
| `DATABASE__CONNECTIONSTRING` | The connection string for the SQLite database. | No       | `Data Source=data/MovieGraphs.db` |

## Build

### Prerequisites

- [Node.js](https://nodejs.org/en/) (minimum version: 18.17.1)
  - Enable corepack by running `corepack enable` in a terminal.
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) or [Docker Engine](https://docs.docker.com/engine/install/)
- [Visual Studio Code](https://code.visualstudio.com/) (optional)
- [Visual Studio 2022](https://visualstudio.microsoft.com/vs/) or [C# Dev Kit for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) (optional)

### Preparation

2. Run `pnpm install` in the root directory to install all dependencies.
3. Run `dotnet dev-certs https --trust` to trust the development certificate.

### Run

1. Run `dotnet watch run` in the `src/server/host` directory to start the server.
2. Run `pnpm run start` in the `src/client` directory to start the client.

or

1. Run the `🚀 Start` task in Visual Studio Code.

Now you can visit [`https://localhost:5001`](https://localhost:5001) in your browser.
The swagger UI is available at [`https://localhost:5001/swagger/index.html`](https://localhost:5001/swagger/index.html).

### Build

1. Run `pnpm build` in the root directory to build the server, client and docker container.
2. The image `masch0212/movie-graphs:latest` is now available in your local docker registry.

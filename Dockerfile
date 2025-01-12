FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine

ARG BUILDTIME=Unknown

# Install the ICU package
RUN apk update
RUN apk add --no-cache icu-libs
RUN apk add --no-cache icu-data-full

WORKDIR /app
EXPOSE 80

ENV BUILDTIME=$BUILDTIME
ENV ASPNETCORE_URLS=http://+:80
ENV ADMIN__USERNAME=
ENV ADMIN__PASSOWRD=
ENV IDS__SEED=

COPY src/server/bin/Release/publish .
RUN mkdir -p wwwroot
COPY src/client/dist/movie-graphs/browser ./wwwroot/

HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

ENTRYPOINT ["dotnet", "MovieGraphs.dll"]

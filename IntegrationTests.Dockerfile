FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine

ARG CONFIGURATION=Release

# Install the ICU package
RUN apk update
RUN apk add --no-cache icu-libs
RUN apk add --no-cache icu-data-full

WORKDIR /app
EXPOSE 80

ENV ASPNETCORE_URLS=http://+:80
ENV ADMIN__USERNAME=admin
ENV ADMIN__PADDWORD=admin
ENV IDS__SEED=inttest
ENV ENABLE_DEV_ENDPOINTS=true

COPY src/server/bin/$CONFIGURATION .
RUN rm -rf ./data

HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

ENTRYPOINT ["dotnet", "MoviewGraphs.Host.dll"]

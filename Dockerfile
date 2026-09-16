# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/MyApplication/MyApplication.sln src/MyApplication/
COPY src/MyApplication/MyApplication.Api/MyApplication.Api.csproj src/MyApplication/MyApplication.Api/
COPY src/MyApplication/MyApplication.Application/MyApplication.Application.csproj src/MyApplication/MyApplication.Application/
RUN dotnet restore src/MyApplication/MyApplication.sln

COPY src/MyApplication/ src/MyApplication/
RUN dotnet publish src/MyApplication/MyApplication.Api/MyApplication.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApplication.Api.dll"]

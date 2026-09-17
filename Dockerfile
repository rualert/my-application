# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/MyApplication/MyApplication.sln src/MyApplication/
COPY src/MyApplication/MyApplication.Api/MyApplication.Api.csproj src/MyApplication/MyApplication.Api/
COPY src/MyApplication/MyApplication.Application/MyApplication.Application.csproj src/MyApplication/MyApplication.Application/
COPY src/MyApplication/MyApplication.Infrastructure/MyApplication.Infrastructure.csproj src/MyApplication/MyApplication.Infrastructure/
COPY src/MyApplication/MyApplication.Domain/MyApplication.Domain.csproj src/MyApplication/MyApplication.Domain/
RUN dotnet restore src/MyApplication/MyApplication.Api/MyApplication.Api.csproj

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

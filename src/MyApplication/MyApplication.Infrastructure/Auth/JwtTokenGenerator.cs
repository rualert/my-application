using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using MyApplication.Application.Auth;
using MyApplication.Domain.Auth;

namespace MyApplication.Infrastructure.Auth;

public class JwtTokenGenerator : IJwtTokenGenerator
{
    private readonly string _issuer;
    private readonly string _audience;
    private readonly SigningCredentials _signingCredentials;
    private readonly TimeSpan _accessTokenLifetime;

    /// <summary>
    ///     Создаёт генератор access token'ов, подписывающий их ключом из конфигурации <c>Jwt:SigningKey</c>.
    /// </summary>
    public JwtTokenGenerator(IConfiguration configuration)
    {
        _issuer = configuration["Jwt:Issuer"]
                  ?? throw new InvalidOperationException("Не задан Jwt:Issuer в конфигурации.");
        _audience = configuration["Jwt:Audience"]
                    ?? throw new InvalidOperationException("Не задан Jwt:Audience в конфигурации.");
        var signingKey = configuration["Jwt:SigningKey"]
                          ?? throw new InvalidOperationException("Не задан Jwt:SigningKey в конфигурации.");
        _signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);

        var lifetimeMinutes = configuration.GetValue<int?>("Jwt:AccessTokenLifetimeMinutes") ?? 15;
        _accessTokenLifetime = TimeSpan.FromMinutes(lifetimeMinutes);
    }

    /// <summary>
    ///     Выпускает новый access token для пользователя.
    /// </summary>
    public AccessToken GenerateAccessToken(User user)
    {
        var expiresAt = DateTimeOffset.UtcNow.Add(_accessTokenLifetime);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: expiresAt.UtcDateTime,
            signingCredentials: _signingCredentials);

        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}

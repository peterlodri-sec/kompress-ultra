# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ Yes |
| 1.0.x   | ❌ No |
| < 1.0   | ❌ No |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing:

**peter@peterl.dev**

Include:
- Description of the vulnerability
- Steps to reproduce (if applicable)
- Affected version(s)
- Suggested fix (if you have one)

## Response Timeline

- **Acknowledgement**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Resolution target**: Within 30 days (complex issues may take longer)

## Scope

Security issues in scope:
- Token estimation bypass or manipulation
- Circuit breaker state poisoning
- Worker auth bypass
- Injection via message content (regex DoS, prototype pollution)
- Credential leakage through error messages or logs

Out of scope:
- Issues in upstream dependencies (report to those projects)
- Issues requiring physical access to the host
- Denial of service through resource exhaustion (configurable limits exist)

## Security Features

### Worker Authentication (v2.0+)

The Cloudflare Worker API supports optional Bearer token authentication:

```bash
# Set token via Wrangler secrets
wrangler secret put AUTH_TOKEN

# Use in requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -X POST https://your-worker.dev/v1/compress \
  -d '{"messages": [...]}'
```

When `AUTH_TOKEN` is configured, all mutation endpoints (`/v1/compress`, `/v1/score`, `/v1/rewrite`) require valid auth. Read-only endpoints (`/v1/health`, `/v1/budget`) remain open.

### Circuit Breaker

External service failures (Milvus, embedding API) trigger a circuit breaker that prevents cascading failures. Configurable threshold and cooldown:

```typescript
const breaker = createCircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 30_000,
});
```

## Responsible Disclosure

We appreciate responsible disclosure. If you report a valid security issue:
- You will be credited in the security advisory (unless you prefer anonymity)
- We will work with you on the fix before public disclosure
- We aim for coordinated disclosure within 90 days

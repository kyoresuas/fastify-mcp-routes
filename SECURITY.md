# Security Policy

fastify-mcp-routes lets AI agents call the routes of a Fastify application. A mistake in route selection, header forwarding, or origin checks can expose a private or mutating route. Please treat suspected vulnerabilities as sensitive.

## Supported versions

Security fixes are applied to the latest code on the `main` branch and released as a new version of the npm package. Older versions are not maintained separately.

## Reporting a vulnerability

Do not open a public GitHub issue.

Email [hey@kyoresuas.com](mailto:hey@kyoresuas.com) with:

- a clear description of the vulnerability and its impact;
- the plugin options, route definitions, and MCP client involved;
- the version of fastify-mcp-routes, Fastify, and Node.js;
- minimal reproduction steps or a proof of concept;
- whether the report may be credited publicly after a fix.

Remove real API keys, tokens, production URLs, and other sensitive data from the report. Use disposable credentials whenever possible.

The report will be reviewed before details are made public. Please allow time for investigation and remediation, and coordinate disclosure with the maintainer.

## Deployment responsibility

The plugin forwards the `Authorization` and `x-api-key` headers of the MCP request to the route it calls, and it does not authenticate the `/mcp` endpoint itself. Operators are responsible for TLS termination, network restrictions, protecting the endpoint with their own hooks, reviewing which routes are exposed with `app.mcpRoutes.routes()`, and keeping dependencies up to date. See the security section in [README.md](README.md#security).

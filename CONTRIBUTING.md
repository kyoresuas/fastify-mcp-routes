# Contributing to fastify-mcp-routes

Thanks for helping improve fastify-mcp-routes. Bug fixes, compatibility reports for MCP clients, documentation, tests, and support for more route schema styles are welcome.

## Before you start

- Search existing issues before opening a new one.
- Use a GitHub issue for substantial features or behavior changes so the approach can be discussed first.
- Do not publish API keys, tokens, production URLs, or private route schemas.
- Report security vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Local development

Requirements:

- Node.js 22.12 or newer
- npm

Install dependencies and run the checks:

```bash
npm ci
npm run lint
npm test
```

The integration tests start a Fastify server on a free port of `127.0.0.1` and talk to it with the official MCP client. They need no network access. Architecture and code style are described in [AGENTS.md](AGENTS.md).

## Project checks

Run all required checks before opening a pull request:

```bash
npm run lint
npm test
npm run build
npm run bench
```

Use `npm run test:watch` while developing and `npm run test:coverage` when changing the plugin behavior.

## README image

The picture at the top of both READMEs, `docs/bench.svg`, is a terminal window with the real output of `npm run bench`. It is generated, not drawn: `npm run docs:bench` runs `npm run bench`, takes its output as it is and writes the SVG (the script is `scripts/render-bench.ts`). The window has a light and a dark theme through `prefers-color-scheme`.

Run `npm run docs:bench` whenever a change moves the bench numbers and commit the new SVG together with that change. A unit test fails when the picture differs from the current output of `npm run bench`.

## Pull requests

1. Keep each pull request focused on one problem.
2. Explain the user-visible behavior and the reason for the change.
3. Add or update Vitest tests for behavior changes and bug fixes.
4. Update both `README.md` and `README_RU.md` when public behavior or options change.
5. Take every number in the READMEs from the real output of `npm run bench` or `app.mcpRoutes.stats()`, and regenerate `docs/bench.svg` with `npm run docs:bench` when they change.
6. Call out changes to the safe defaults, tool naming, or option names explicitly.
7. Never commit `dist/`, `coverage/`, or `node_modules/`.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).

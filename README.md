# Aman Kumar Pandit — Developer Portfolio

React, TypeScript and Vite frontend with an Express API for the AI portfolio assistant, RAG retrieval, and optional GitHub repository data.

## Run locally

1. Install the frontend dependencies with `npm install`.
2. Install API dependencies with `npm --prefix server install`.
3. Copy `.env.example` to `.env` and set the credentials for the services you want to use.
4. Start the API with `npm run server:dev` and the frontend with `npm run dev`.

GitHub integration is optional. Set `GITHUB_USERNAME` to the public GitHub account to show repositories. `GITHUB_TOKEN` is optional and is used only by the server; unauthenticated access is used when it is unset. Redis is also optional. To enable shared caching and distributed chat rate limiting locally, start Redis with `docker run --name portfolio-redis -p 6379:6379 -d redis:7-alpine` and set `REDIS_URL=redis://localhost:6379` in `.env`. Do not add `.env` to version control.

## GitHub integration

The browser requests normalized repository data from the Express API. The server calls the configured GitHub API base URL, filters and sorts public repositories, and stores the result in a small in-memory TTL cache. Repository data stays separate from `src/data/portfolioData.json` and is not automatically added to the RAG vector collection or sent to Gemini.

Configuration:

- `GITHUB_USERNAME` — account whose public repositories are listed; required to enable the integration.
- `GITHUB_TOKEN` — optional server-only token for authenticated GitHub API access.
- `GITHUB_API_BASE_URL` — defaults to `https://api.github.com`.
- `GITHUB_CACHE_TTL_SECONDS` — defaults to 900 seconds.
- `GITHUB_MAX_REPOSITORIES` — maximum number returned; defaults to 12.
- `GITHUB_INCLUDE_FORKS` and `GITHUB_INCLUDE_ARCHIVED` — default to `false`.

Endpoints:

- `GET /api/github/repos` — normalized repositories, sorted by last update. Forks and archived repositories are excluded by default.
- `GET /api/github/repos/:owner/:repo/readme` — explicitly fetches and normalizes a README for the configured owner. README data is cached and is never fetched for every repository automatically.

Requests during the cache TTL reuse the stored response. Redis shares the normalized response across server instances; an in-memory TTL cache remains active as fallback. Concurrent cache misses share one upstream request. GitHub rate-limit and service failures return safe errors; the portfolio remains usable and the GitHub section shows its unavailable state. If the username is unset, the API reports that GitHub integration is not configured and does not imply that the account has no public repositories.

Redis is configured with `REDIS_URL` and `REDIS_KEY_PREFIX` (`portfolio:` by default). With Redis enabled, chat rate limits are shared across instances, GitHub data uses a shared cache, and RAG retrieval results are cached for `RAG_CACHE_TTL_SECONDS` (300 seconds by default). Without Redis, the app starts normally and uses in-memory rate limiting and GitHub cache fallback; RAG continues without a retrieval cache. Docker is optional.

`TRUST_PROXY` defaults to `false`, preserving direct-connection behavior. Set it to `true` only when every proxy hop is trusted, or to a non-negative hop count for a known proxy topology. Express uses this value for HTTP client IP resolution; WebSocket uses the same trusted-hop policy. Both paths hash the resolved client identity before applying rate limits. Do not enable proxy trust unless the service is reachable only through the configured trusted proxy chain.

## AI chat streaming

The API keeps `POST /api/chat` and attaches a `ws` WebSocket server to the same HTTP server at `/ws/chat`. The browser reuses one socket while the chat panel is open. If WebSocket is unavailable before sending a request, the UI automatically uses the REST endpoint. Both transports share RAG retrieval, context assembly, Gemini settings, and the same 20 requests per 15 minutes limiter. Gemini generation uses the installed `@google/genai` SDK `generateContentStream` API; the model is selected server-side with `GEMINI_MODEL`.

The JSON protocol accepts `chat.start` with a unique `requestId` and `message`, and `chat.cancel` with a `requestId`. Server events are `chat.started` (includes `conversationId`), `chat.delta`, `chat.completed` (includes complete `message` and `sources`), `chat.error`, and `chat.cancelled`. Requests are limited to 2,000 characters and one active generation per connection. WebSocket connections are limited to 200 by default and idle sockets close after 120 seconds. Override those defaults with `WS_MAX_CONNECTIONS` and `WS_IDLE_TIMEOUT_MS` if needed. Origins are checked against `CLIENT_URL`; clients without an Origin header are allowed, matching the REST CORS policy.

The SDK accepts an abort signal and the Stop button uses it to cancel provider work. WebSocket connection attempts are bounded and do not retry while the browser is offline. Connection failures fall back to REST. If the socket drops during a request, the server aborts work on its closed connection and the UI retries through REST. No Gemini credentials, prompts, or provider controls are sent by the browser.

## Tests and builds

- `npm run github:test` — mocked GitHub client, service and route tests, including the existing RAG tests.
- `npm run rag:ingest` — ingests canonical portfolio documents into the configured Qdrant instance; requires Gemini and vector database configuration.
- `npm run build` — type-checks and builds the frontend.
- `npm test` runs frontend tests; `npm run test:server` runs API, RAG, GitHub, Redis mock, and WebSocket protocol tests. Streaming tests use mocked Gemini output and require no Gemini, Qdrant, or Redis credentials.

## Operations and diagnostics

The API emits structured JSON logs with `timestamp`, `level`, and `event` fields. `LOG_LEVEL` supports `debug`, `info`, `warn`, and `error` and defaults to `info`. Request logs include a validated `requestId` (also returned as `X-Request-Id`), method, route pattern, status, and duration. AI and WebSocket events correlate with that request ID or their connection/request IDs. Logs omit request bodies, prompts, generated answers, credentials, and provider error messages. For production debugging, use the response `X-Request-Id` to find the matching safe server events; temporarily set `LOG_LEVEL=debug` only when cache detail is needed.

Health routes:

- `GET /api/health` keeps the existing health URL and reports overall status plus dependencies.
- `GET /api/health/live` reports whether the process can answer HTTP requests.
- `GET /api/health/ready` returns HTTP 200 only when Gemini is configured and Qdrant has been observed available. Missing required AI configuration or an observed Qdrant outage returns 503 with `unavailable`; before the first Qdrant operation it reports `degraded`/`unknown` and returns 503. Gemini state means only that a key is configured; readiness does not call Gemini or prove provider reachability. Redis and GitHub are optional and do not affect readiness. Other portfolio routes remain available when AI dependencies are unavailable. Health checks make no provider network calls.
- `GET /api/metrics` returns only aggregate in-process request, error, duration, AI, RAG, GitHub, Redis, Qdrant, and WebSocket counters. It contains no user/request content, credentials, or per-user data. It is unauthenticated; restrict access at the infrastructure layer if metrics should be private.

HTTP errors use a consistent `{ error: { code, message, requestId } }` response. WebSocket errors use stable safe protocol codes and carry the connection/request correlation IDs in logs. The React root has a minimal error boundary with a reload action. The backend does not serve the production frontend itself; Vite handles client-side routes during development, so API 404 handling does not replace frontend routing.

Verification is local and mock-based. No live Gemini, Redis, or Qdrant integration is implied by passing tests.

Qdrant collection setup creates a missing collection with `EMBEDDING_DIMENSIONS` and `VECTOR_DB_DISTANCE` (`Cosine` by default). Existing collections are checked for both values and are not recreated automatically when incompatible. WebSocket cancellation propagates through Gemini embeddings, Qdrant HTTP fetches, and generation. Gemini documents that aborting an embedding request cancels the client operation but may not cancel provider-side processing or billing. Aborting a Qdrant fetch stops the client wait; it does not guarantee that Qdrant has stopped work already received.

Dependency versions are currently pinned by lockfiles while several manifest entries use `latest`. Future dependency updates should use controlled version ranges and reviewed lockfile changes rather than broad automatic upgrades.

## Production deployment

Deploy the Vite frontend and Express API separately. Build the frontend with `VITE_API_BASE_URL` set to the API origin when the hosts differ (for example, `VITE_API_BASE_URL=https://api.example.com npm run build`); if unset, the browser uses the frontend's own origin. Host the generated `dist` files with client-route fallback to `index.html`. The frontend uses the same API base for REST and derives `ws:`/`wss:` `/ws/chat` for streaming.

Run the persistent Node API with `npm run server:start` from the project root, or `npm start` from `server/`. The API and WebSocket endpoint share one HTTP listener. A reverse proxy must forward WebSocket upgrades for `/ws/chat`. Set `CLIENT_URL` to the allowed frontend origin (comma-separated origins are accepted); the default is local development. Set `PORT` if the platform does not provide the default port 3001.

AI chat requires `GEMINI_API_KEY` and `VECTOR_DB_URL`. `VECTOR_DB_API_KEY` is conditional on whether the Qdrant endpoint requires authentication. The implementation names the collection setting `VECTOR_DB_COLLECTION` (default `aman_portfolio`); there is no `VECTOR_DB_INDEX` variable. `EMBEDDING_MODEL` defaults to `gemini-embedding-001`, `EMBEDDING_DIMENSIONS` to 768, and `VECTOR_DB_DISTANCE` to `Cosine`; these must match the vector collection. Run `npm run rag:ingest` after configuration to populate the collection.

Set `TRUST_PROXY` only for a known proxy topology; it defaults to `false`. Redis is optional for a single instance. Configure `REDIS_URL` when shared rate limiting/caches are needed across instances; `REDIS_KEY_PREFIX` and `RAG_CACHE_TTL_SECONDS` have defaults. The API must run as a persistent process for WebSockets and its in-process metrics/fallback state.

Optional GitHub configuration is `GITHUB_USERNAME` (enables the integration), `GITHUB_TOKEN` (optional authentication), and `GITHUB_API_BASE_URL` (defaults to `https://api.github.com`). Cache/repository options include `GITHUB_CACHE_TTL_SECONDS`, `GITHUB_MAX_REPOSITORIES`, `GITHUB_INCLUDE_FORKS`, and `GITHUB_INCLUDE_ARCHIVED`. `LOG_LEVEL` defaults to `info`; `WS_MAX_CONNECTIONS` and `WS_IDLE_TIMEOUT_MS` also have defaults.

After deployment, check `/api/health/live`, `/api/health/ready`, and `/api/metrics`. Readiness returns 503 while required AI configuration is missing, Qdrant is unknown before its first operation, or Qdrant is observed unavailable; it does not make provider calls and does not verify Gemini reachability. Redis/GitHub outages are optional. Restrict unauthenticated `/api/metrics` at the infrastructure layer if needed. Local production-mode startup, HTTP health/metrics, WebSocket upgrade/origin/size/rate-limit behavior, static frontend delivery, and configured-origin CORS were checked. Live Gemini, Qdrant, Redis, and GitHub were not checked because no credentials or endpoints were configured; WebSocket streaming through a reverse proxy was not checked.

## Local AI assistant

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
2. Run `npm run dev:all` to start both the Vite frontend and Express AI server.
3. If `VECTOR_DB_URL` is empty, the assistant uses the canonical portfolio data as a local retrieval fallback. If Qdrant is configured, the existing RAG pipeline is used.

The Vite dev server proxies both `/api` and `/ws` to the local AI server.
## Local development

From the project root, install both frontend and backend dependencies:

```bash
npm install
```

Then start Vite, Express, and WebSocket together:

```bash
npm run dev:all
```

Frontend: `http://localhost:5173`  
Backend/API: `http://localhost:3001`

Set `GEMINI_API_KEY` in the root `.env` file before testing Ask Aman AI.



### Local development

Run `npm install`, then `npm run dev:all`. The launcher installs backend dependencies from the `server/` directory using the Windows-safe `npm install --no-audit --no-fund` command when needed.

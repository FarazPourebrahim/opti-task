# Deploying the Frontend

The client is a static site: `vite build` produces files, and any host that
can serve files and rewrite unknown paths to `index.html` can run it. It talks
to the API from the browser; there is no server of its own.

---

## 1. Decide where it lives — before anything else

The session is two cookies the **API** sets, `HttpOnly` and `SameSite=Lax`.
Whether the browser sends them back depends on where the client is served
from, relative to the API.

| Client | API | Works? |
|---|---|---|
| `app.example.com` | `api.example.com` | Yes — same site. The intended shape. |
| `example.com` | `example.com/graphql` (one origin, behind a proxy) | Yes, and no CORS is involved at all. |
| `app.example.net` | `api.example.com` | **No.** The cookies are never sent; every request after sign-in is refused. |

The third shape needs backend work first: `SameSite=None; Secure` cookies and
a real CSRF token (see `apps/backend/docs/deployment.md`). It passes every
test on a developer's machine, where both are `localhost`, and fails only in
production — so settle this before choosing hostnames.

Both must be served over **HTTPS** in production: the API marks its cookies
`Secure`, and "Copy link" needs a secure origin.

---

## 2. Build

From the repository root:

```bash
pnpm install --frozen-lockfile
VITE_API_URL=https://api.example.com/graphql \
VITE_WS_URL=wss://api.example.com/graphql \
pnpm --filter optitask-frontend run build
pnpm --filter optitask-frontend run build:check
```

| Variable | Value |
|---|---|
| `VITE_API_URL` | The API's GraphQL endpoint, `https://…/graphql` |
| `VITE_WS_URL` | The same endpoint for subscriptions, `wss://…/graphql` |

They are compiled **into** the bundle, so a build belongs to one environment:
build again for another. Nothing secret may go in a `VITE_` variable — it
would be readable by every visitor.

The output is `apps/frontend/dist/`. `@contracts` is inlined; the artifact has
no dependency on the workspace.

`build:check` fails the release if the stylesheet lost Avero's classes, if a
script still imports `@contracts`, or if a bundle carries a source-map pointer
or something shaped like a secret.

---

## 3. Tell the API about it

Add the client's origin to the API's `CORS_ORIGINS` — the bare origin, no
path and no trailing slash:

```
CORS_ORIGINS=https://app.example.com
```

Without it the browser discards every response and the app shows "Can't reach
the server".

---

## 4. Serve

### Single-page fallback

Every path that is not a file must answer with `index.html` and status 200.
`/projects/123/board` is a route inside the app, not a file; without the
rewrite, a reload or a shared link is a 404.

```nginx
location / {
  try_files $uri /index.html;
}
```

### Caching

| Path | Header | Why |
|---|---|---|
| `/index.html` | `Cache-Control: no-cache` | It names the current bundle; a stale copy pins users to an old release |
| `/assets/*` | `Cache-Control: public, max-age=31536000, immutable` | Every file name carries a content hash |

### Source maps

The build writes a `.map` beside every script but does not point at them from
the scripts. Upload them to an error tracker if one is used, and **do not
serve them**: either delete `dist/assets/*.map` before publishing or refuse
the path.

```nginx
location ~ \.map$ { return 404; }
```

### Security headers

Send these with every response. `vite preview` sends the same set (all but
`Strict-Transport-Security`, which means nothing on `localhost`), and the
end-to-end suite passes against the production build under them
(`pnpm run e2e:build`), so the policy below is known to be sufficient — every
screen, the live connection and a drag on the board work with it enforced.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.example.com wss://api.example.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

| Directive | Why it is what it is |
|---|---|
| `script-src 'self'` | No inline script, no `eval`. The app has neither. |
| `style-src 'self' 'unsafe-inline'` | Radix (inside Avero) and the charts position things with inline `style` attributes, and `index.html` carries a few lines of CSS for the first paint. |
| `img-src 'self' data: https:` | Avatars and logos are addresses people paste in, on any host. |
| `font-src 'self'` | The fonts are self-hosted files; none is inlined. |
| `connect-src` | The API, over HTTPS **and** WSS. Leave the `wss:` origin out and the app still works but is never "Live". |
| `frame-ancestors 'none'` | The app is never framed; this replaces `X-Frame-Options`. |

The `connect-src` list is built from the two `VITE_` variables in
`vite.config.ts` (`securityHeaders`). If the policy changes, change it there
too, so the suite keeps testing what is deployed.

---

## 5. Check the release

On the deployed site, not on a developer's machine:

1. `GET https://api.example.com/readyz` answers 200 — the API can reach its
   database.
2. Open the site: the sign-in screen appears, and the console is empty.
3. Sign in, then **reload**. Still signed in means the cookies survive the
   round trip (section 1).
4. Open a project. The badge in the top bar reads **Live** within a few
   seconds — the socket connects and authenticates.
5. Paste a deep link (`/projects/<id>/board`) into a new tab: the board, not
   a 404 (section 4).
6. Sign out, then reload: the sign-in screen.

Steps 2–6 are what `e2e/session.e2e.ts` and `e2e/sweep.e2e.ts` do. Pointing
the suite at a staging deployment needs only `baseURL` in
`playwright.config.ts` and `E2E_API_URL`; it writes test accounts, so never
point it at production.

---

## Continuous integration

A workflow is provided as a template at
[`../ci/github-actions.ci.yml`](../ci/github-actions.ci.yml). It is not active:
copy it to `.github/workflows/` to switch it on, which is the repository
owner's call. It has **never run** — every command in it has been run by
hand on a developer's machine, but the workflow itself is unproven until its
first run.

| Job | Runs |
|---|---|
| `frontend` | typecheck → lint → query-depth → codegen drift → unit tests with coverage floors → build → build check |
| `frontend-e2e` | PostgreSQL, migrations, then the browser suite against the production build |

The codegen drift check is only trustworthy on a Linux runner (see
`known-debt.md`, Phase 6): on a Windows checkout with `core.autocrlf` it
always reports a difference.

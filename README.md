# aa-project-pipeline

Internal Automation Architecture project-status dashboard. Static HTML on Vercel,
edge-gated so `public/index.html` is never served unauthenticated.

## Auth (Clerk — AAA-769 Phase 1)

Replaces shared Supabase Auth (`aaa-internal-auth` / `qmdblnaqpylbnufvarcu`).
There is **no** `SUPABASE_ANON_KEY` (or other Supabase) requirement.

Set these on the Vercel production target (never commit values). Prefer
`aaa-set-env vercel <NAME> <value> production` — do not pipe into
`vercel env add` from a non-TTY (it can store an empty value and exit 0).

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLERK_PUBLISHABLE_KEY` | yes | `pk_live_…` / `pk_test_…`. Login JS loads it from `/api/clerk-config`; middleware passes it to `authenticateRequest`. |
| `CLERK_SECRET_KEY` | yes | `sk_live_…` / `sk_test_…`. Edge session verification. |
| `CLERK_JWT_KEY` | no | PEM public key from Clerk Dashboard → API keys → JWT public key. Enables networkless JWT verify. |

Redeploy after env changes — middleware reads env per-deployment.

**Allowlist:** hard-coded to `brad@automationarchitecture.ai` only. `ALLOWED_EMAILS` is not read and cannot admit anyone else.

In the Clerk Dashboard: disable public sign-ups; add this site's production (and preview, if used) origin to allowed redirect URLs; point the sign-in URL at `/login`.

## ACME

`middleware.js` exempts `/.well-known/` **before** any auth check. Removing that
blocks TLS issuance for a custom domain.

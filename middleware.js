// Supabase session gate for an internal AAA dashboard (static single-page app).
//
// Same edge-gating pattern as the run-rate dashboard: access requires (1) a valid
// Supabase session, AND (2) the session email being on the ALLOWED_EMAILS allowlist.
// The dashboard HTML is never returned to an unauthenticated/unauthorized browser —
// gating happens here at the edge, before the static file (public/index.html) is served.
//
// Dependency-free on purpose (no package.json / no bundle): reads the Supabase session
// cookie, validates the access token against Supabase's /auth/v1/user endpoint, and
// checks the email allowlist. Env vars (Vercel production target; values never in repo):
//   SUPABASE_ANON_KEY  — publishable anon key, sent as the apikey header
//   ALLOWED_EMAILS     — comma-separated allowlist (the real access gate)
// Auth backend: the shared aaa-internal-auth Supabase project (magic-link, auth only).

export const config = { matcher: "/:path*" };

const REF = "qmdblnaqpylbnufvarcu"; // shared aaa-internal-auth Supabase project (auth only, magic-link)
const COOKIE = `sb-${REF}-auth-token`;

function getAllowed() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseCookies(header) {
  const out = {};
  (header || "").split(/; */).forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1);
      // A malformed percent-escape would make decodeURIComponent throw — which in
      // edge middleware 500s the request. Fall back to the raw value instead.
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  });
  return out;
}

function b64urlToString(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

// Reassemble the (possibly chunked) @supabase/ssr session cookie and pull the
// access token out. Value is "base64-<base64url(JSON session)>", split across
// sb-<ref>-auth-token.0/.1/... when it exceeds the cookie size limit.
function extractAccessToken(cookies) {
  let raw = cookies[COOKIE];
  if (raw === undefined) {
    const chunks = [];
    for (let i = 0; cookies[`${COOKIE}.${i}`] !== undefined; i++) {
      chunks.push(cookies[`${COOKIE}.${i}`]);
    }
    if (!chunks.length) return null;
    raw = chunks.join("");
  }
  if (!raw) return null;
  let json = raw;
  if (raw.startsWith("base64-")) {
    try {
      json = b64urlToString(raw.slice(7));
    } catch {
      return null;
    }
  }
  try {
    const session = JSON.parse(json);
    if (Array.isArray(session)) return session[0] || null;
    return session.access_token || null;
  } catch {
    return null;
  }
}

export default async function middleware(req) {
  const { pathname } = new URL(req.url);

  // ACME challenges must never be gated — blocking these stops TLS cert issuance
  // for any custom domain. Keep this first.
  if (pathname.startsWith("/.well-known/")) return;

  // Public auth surfaces (the login flow itself must be reachable unauthenticated).
  if (
    pathname === "/login" ||
    pathname === "/login.html" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/auth/")
  ) {
    return;
  }

  const token = extractAccessToken(parseCookies(req.headers.get("cookie")));
  if (token) {
    try {
      const r = await fetch(`https://${REF}.supabase.co/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.SUPABASE_ANON_KEY || "",
        },
      });
      if (r.ok) {
        const user = await r.json();
        const email = (user.email || "").toLowerCase();
        if (email && getAllowed().includes(email)) return; // authorized → serve
        return Response.redirect(new URL("/login?error=forbidden", req.url), 302);
      }
    } catch {
      // network/validation failure → treat as unauthenticated
    }
  }
  return Response.redirect(new URL("/login", req.url), 302);
}

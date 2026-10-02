// Clerk session gate for an internal AAA dashboard (static single-page app).
//
// AAA-769 Phase 1: replaces shared Supabase Auth (aaa-internal-auth /
// qmdblnaqpylbnufvarcu) with Clerk. Access requires (1) a valid Clerk
// session, AND (2) the session email being exactly
// brad@automationarchitecture.ai. The dashboard HTML is never returned to
// an unauthenticated/unauthorized browser — gating happens here at the
// edge, before the static file (public/index.html) is served.
//
// Env vars (Vercel production target; values never in repo):
//   CLERK_PUBLISHABLE_KEY  — pk_live_… / pk_test_… (also used by login JS)
//   CLERK_SECRET_KEY       — sk_live_… / sk_test_… (edge verification)
//   CLERK_JWT_KEY          — optional PEM public key for networkless JWT verify
// Shared-auth anon keys are not used. ALLOWED_EMAILS is not read — a mis-set
// env var must not widen the allowlist.

import { createClerkClient } from "@clerk/backend";

export const config = { matcher: "/:path*" };

export const ALLOWED_EMAILS = Object.freeze([
  "brad@automationarchitecture.ai",
]);

export function isAllowedEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  return Boolean(normalized) && ALLOWED_EMAILS.includes(normalized);
}

export function isAcmePath(pathname) {
  return pathname.startsWith("/.well-known/");
}

export function isPublicPath(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/login.html" ||
    pathname.startsWith("/login/") ||
    pathname === "/favicon.ico" ||
    pathname === "/sso-callback" ||
    pathname === "/sso-callback.html" ||
    pathname === "/api/clerk-config" ||
    pathname.startsWith("/auth/")
  );
}

export function emailFromClaims(claims) {
  if (!claims || typeof claims !== "object") return "";
  const raw =
    claims.email ||
    claims.email_address ||
    claims.primary_email_address ||
    "";
  return String(raw).trim().toLowerCase();
}

function getClerk() {
  return createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY || "",
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || "",
  });
}

async function sessionEmail(clerk, requestState) {
  const auth = requestState.toAuth();
  if (!auth?.userId) return "";

  const fromClaims = emailFromClaims(auth.sessionClaims);
  if (fromClaims) return fromClaims;

  try {
    const user = await clerk.users.getUser(auth.userId);
    return (
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      ""
    )
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

export default async function middleware(req) {
  const { pathname, origin } = new URL(req.url);

  // ACME challenges must never be gated — blocking these stops TLS cert issuance
  // for any custom domain. Keep this first.
  if (isAcmePath(pathname)) return;

  // Public auth surfaces (the login flow itself must be reachable unauthenticated).
  if (isPublicPath(pathname)) return;

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
  const secretKey = process.env.CLERK_SECRET_KEY || "";
  if (!publishableKey || !secretKey) {
    return Response.redirect(new URL("/login", req.url), 302);
  }

  try {
    const clerk = getClerk();
    const requestState = await clerk.authenticateRequest(req, {
      secretKey,
      publishableKey,
      authorizedParties: [origin],
      jwtKey: process.env.CLERK_JWT_KEY || undefined,
    });

    if (requestState.status === "handshake") {
      if (requestState.headers.get("location")) {
        return new Response(null, {
          status: 307,
          headers: requestState.headers,
        });
      }
      return Response.redirect(new URL("/login", req.url), 302);
    }

    if (!requestState.isAuthenticated) {
      return Response.redirect(new URL("/login", req.url), 302);
    }

    const email = await sessionEmail(clerk, requestState);
    if (isAllowedEmail(email)) return; // authorized → serve
    return Response.redirect(new URL("/login?error=forbidden", req.url), 302);
  } catch {
    // network/validation failure → treat as unauthenticated
    return Response.redirect(new URL("/login", req.url), 302);
  }
}

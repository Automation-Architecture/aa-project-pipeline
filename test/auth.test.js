import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOWED_EMAILS,
  emailFromClaims,
  isAcmePath,
  isAllowedEmail,
  isPublicPath,
} from "../middleware.js";

const AUTH_FILES = [
  "middleware.js",
  "api/clerk-config.js",
  "public/login.html",
  "public/sso-callback.html",
  "public/auth/callback.html",
];

test("allowlist is only brad@", () => {
  assert.deepEqual([...ALLOWED_EMAILS], ["brad@automationarchitecture.ai"]);
  assert.equal(isAllowedEmail("brad@automationarchitecture.ai"), true);
  assert.equal(isAllowedEmail("Brad@AutomationArchitecture.ai"), true);
  assert.equal(isAllowedEmail(" brad@automationarchitecture.ai "), true);
  assert.equal(isAllowedEmail("engineer@automationarchitecture.ai"), false);
  assert.equal(isAllowedEmail("other@gmail.com"), false);
  assert.equal(isAllowedEmail(""), false);
  assert.equal(isAllowedEmail(null), false);
});

test("ACME paths are recognized before any other gate", () => {
  const source = readFileSync("middleware.js", "utf8");
  const acmeIdx = source.indexOf("isAcmePath(pathname)");
  const clerkIdx = source.indexOf("authenticateRequest");
  assert.ok(acmeIdx > 0 && acmeIdx < clerkIdx);
  assert.equal(isAcmePath("/.well-known/acme-challenge/xyz"), true);
  assert.equal(isAcmePath("/login"), false);
});

test("login and Clerk handshake surfaces are public; dashboard is not", () => {
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/login.html"), true);
  assert.equal(isPublicPath("/login/sso-callback"), true);
  assert.equal(isPublicPath("/sso-callback"), true);
  assert.equal(isPublicPath("/api/clerk-config"), true);
  assert.equal(isPublicPath("/auth/callback"), true);
  assert.equal(isPublicPath("/favicon.ico"), true);
  assert.equal(isPublicPath("/"), false);
  assert.equal(isPublicPath("/index.html"), false);
});

test("session claim email is read when present", () => {
  assert.equal(emailFromClaims({ email: "Brad@AutomationArchitecture.ai" }), "brad@automationarchitecture.ai");
  assert.equal(emailFromClaims({ email_address: "brad@automationarchitecture.ai" }), "brad@automationarchitecture.ai");
  assert.equal(emailFromClaims({ sub: "user_123" }), "");
  assert.equal(emailFromClaims(null), "");
});

test("runtime auth files have no Supabase auth", () => {
  const forbidden = [
    "supabase.co",
    "@supabase",
    "SUPABASE_ANON_KEY",
    "createBrowserClient",
    "sb-qmdblnaqpylbnufvarcu",
  ];
  for (const file of AUTH_FILES) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.equal(text.includes(needle), false, `${file} contains ${needle}`);
    }
  }
});

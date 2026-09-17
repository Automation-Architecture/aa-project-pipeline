export const config = { runtime: "edge" };

// Publishable key only — safe to expose to the login page. Secret key stays
// on the edge middleware.
export default function handler() {
  return new Response(
    JSON.stringify({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || "",
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

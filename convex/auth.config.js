// NEW CODE — Clerk authentication provider config for Convex
// This tells Convex to trust JWT tokens from your Clerk application
export default {
  providers: [
    {
      // Your Clerk Frontend API domain (derived from publishable key)
      // Verify at: https://dashboard.clerk.com → API Keys
      domain: "https://unique-stag-11.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

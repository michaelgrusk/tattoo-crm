import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// Server-only — never import in client components.
// Lazy factory so build doesn't fail if PADDLE_API_KEY isn't set.
export function getPaddle(): Paddle {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("Missing PADDLE_API_KEY env var");

  return new Paddle(key, {
    environment: key.startsWith("pdl_live_")
      ? Environment.production
      : Environment.sandbox,
  });
}

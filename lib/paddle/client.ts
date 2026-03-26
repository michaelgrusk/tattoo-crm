import { initializePaddle, type Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | undefined;

// Call once in a client component to get the initialized Paddle.js instance.
export async function getPaddleClient(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) {
    console.error("Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
    return undefined;
  }

  paddleInstance = await initializePaddle({
    token,
    environment: token.startsWith("live_") ? "production" : "sandbox",
  });

  return paddleInstance;
}

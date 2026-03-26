import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Force dynamic so Next.js never statically optimises this route away.
export const dynamic = "force-dynamic";

// serve() returns a function with GET/POST/PUT as non-enumerable properties.
// Assign explicitly so Turbopack/Next.js recognises them as named route handlers.
const handler = serve({ client: inngest, functions });

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;

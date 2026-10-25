import type { NextRequest } from "next/server";
import { processFailureQueue } from "@/lib/failure-analysis";

// Grok can take a minute per page.
export const maxDuration = 300;

const BATCH_SIZE = 3;

// Run daily by Vercel Cron (see vercel.json), which sends the CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const processed = await processFailureQueue(BATCH_SIZE);
    return Response.json({ processed });
  } catch (err) {
    console.error("Failure queue run failed", err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

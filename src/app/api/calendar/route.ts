import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { buildIcs } from "@/lib/calendar";

// Serves a one-event .ics file. iPhone Safari opens it straight into Calendar.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = (params.get("title") ?? "").trim().slice(0, 200);
  const stamp = params.get("start") ?? "";
  const minutes = Number(params.get("minutes"));
  const url = params.get("url") ?? "";
  const details = (params.get("details") ?? "").slice(0, 4000);

  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!title || !m || !Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60 || !isHttpUrl(url)) {
    return new Response("Invalid calendar event.", { status: 400 });
  }
  const start = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));

  const ics = buildIcs({ title, start, minutes, details, url }, `${randomUUID()}@justrecipe`);
  const filename = title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "recipe";
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

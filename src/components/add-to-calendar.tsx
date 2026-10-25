"use client";

import { useState } from "react";
import { googleCalendarUrl, icsUrl, recipeEvent } from "@/lib/calendar";
import type { Recipe } from "@/lib/recipe";

const pad = (n: number) => String(n).padStart(2, "0");

// Tonight at 6pm, or the next half hour if it's already later than that.
function defaultStart(): { date: string; time: string } {
  const d = new Date();
  if (d.getHours() >= 18) {
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  } else {
    d.setHours(18, 0, 0, 0);
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function AddToCalendar({ recipe }: { recipe: Recipe & { id?: string } }) {
  const [start, setStart] = useState(defaultStart);
  const startDate = new Date(`${start.date}T${start.time}`);
  const valid = !Number.isNaN(startDate.getTime());

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-border px-5 py-2.5 font-medium hover:bg-accent-soft [&::-webkit-details-marker]:hidden">
        Add to calendar
      </summary>
      <div className="absolute left-0 z-10 mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <p className="text-sm font-medium">When are you cooking?</p>
        <div className="mt-2 flex gap-2">
          <input
            type="date"
            aria-label="Date"
            value={start.date}
            onChange={(e) => setStart((s) => ({ ...s, date: e.target.value }))}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="time"
            aria-label="Time"
            value={start.time}
            onChange={(e) => setStart((s) => ({ ...s, time: e.target.value }))}
            className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={valid ? icsUrl(recipe, startDate) : undefined}
            aria-disabled={!valid}
            className="rounded-full bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-accent-hover aria-disabled:opacity-50"
          >
            iPhone / Apple Calendar
          </a>
          <a
            href={valid ? googleCalendarUrl(recipeEvent(recipe, startDate)) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!valid}
            className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-accent-soft aria-disabled:opacity-50"
          >
            Android / Google Calendar
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">Includes the ingredient list and a reminder an hour before.</p>
      </div>
    </details>
  );
}

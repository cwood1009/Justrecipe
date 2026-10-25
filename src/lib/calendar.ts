// Builds "add to calendar" events: an .ics file (Apple Calendar on iPhone/Mac,
// Outlook) and a Google Calendar link (Android).

export type CalendarEvent = {
  title: string;
  start: Date;
  minutes: number;
  details: string;
  url: string;
};

/** "1 hr 15 min" → 75. Falls back to an hour when the time can't be read. */
export function durationMinutes(...times: (string | null)[]): number {
  for (const time of times) {
    if (!time) continue;
    const days = Number(time.match(/(\d+)\s*d/i)?.[1] ?? 0);
    const hours = Number(time.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
    const mins = Number(time.match(/(\d+)\s*m/i)?.[1] ?? 0);
    const total = Math.round(days * 1440 + hours * 60 + mins);
    if (total > 0) return Math.min(Math.max(total, 15), 24 * 60);
  }
  return 60;
}

/** UTC timestamp in the compact form both formats use: 20261025T230000Z. */
export function calendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${calendarStamp(event.start)}/${calendarStamp(end)}`,
    details: `${event.url}\n\n${event.details}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Link to our .ics endpoint; iPhone Safari offers to add it to Calendar. */
export function icsUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    title: event.title,
    start: calendarStamp(event.start),
    minutes: String(event.minutes),
    url: event.url,
    details: event.details,
  });
  return `/api/calendar?${params}`;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545 lines must be folded at 75 octets.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CalendarEvent, uid: string, now = new Date()): string {
  const end = new Date(event.start.getTime() + event.minutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JustRecipe//Cook a recipe//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${calendarStamp(now)}`,
    `DTSTART:${calendarStamp(event.start)}`,
    `DTEND:${calendarStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`${event.url}\n\n${event.details}`)}`,
    `URL:${event.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

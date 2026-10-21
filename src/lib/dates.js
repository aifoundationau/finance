export const TZ = "Australia/Sydney";
const DAY = 86_400_000;

const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date (YYYY-MM-DD) in Sydney for an instant. */
export const sydneyDate = (d = new Date()) => isoDateFmt.format(d instanceof Date ? d : new Date(d));

export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysAgo = (n, from = new Date()) => new Date(from.getTime() - n * DAY);
export const daysAhead = (n, from = new Date()) => new Date(from.getTime() + n * DAY);

/** Offset of `tz` from UTC at `date`, in minutes (e.g. +660 for AEDT). */
export function tzOffsetMinutes(date, tz = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Wall-clock time in `tz` to the matching UTC instant. */
export function zonedToUtc(y, mo, d, h = 0, mi = 0, tz = TZ) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - tzOffsetMinutes(new Date(guess), tz) * 60_000;
  return new Date(guess - tzOffsetMinutes(new Date(first), tz) * 60_000);
}

/** Next occurrence of HH:MM Sydney time after `now`. */
export function nextRunAt(hhmm, now = new Date()) {
  const [h, m] = hhmm.split(":").map(Number);
  const today = sydneyDate(now);
  for (const iso of [today, addDays(today, 1)]) {
    const [y, mo, d] = iso.split("-").map(Number);
    const t = zonedToUtc(y, mo, d, h, m);
    if (t > now) return t;
  }
  return daysAhead(1, now);
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
export const monthNumber = (name) => MONTHS[String(name).slice(0, 4).toLowerCase()] ?? MONTHS[String(name).slice(0, 3).toLowerCase()];

export const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

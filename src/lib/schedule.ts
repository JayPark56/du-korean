// Schedule grid helpers. All days/times are America/Denver wall-clock values,
// so a slot means the same moment for Jay and every student.

export const TIMEZONE = "America/Denver";

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Day = (typeof DAYS)[number];
export type Slot = { day: Day; time: string };
export type Locale = "en" | "ko";

const DAY_LABELS: Record<Locale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ko: ["월", "화", "수", "목", "금", "토", "일"],
};

// 8:00 AM – 9:00 PM in 30-minute slots (last slot starts 8:30 PM).
const START_MINUTES = 8 * 60;
const END_MINUTES = 21 * 60;
const STEP_MINUTES = 30;

const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const TIMES: string[] = Array.from(
  { length: (END_MINUTES - START_MINUTES) / STEP_MINUTES },
  (_, i) => toHHMM(START_MINUTES + i * STEP_MINUTES),
);

/**
 * Column layout for every schedule grid: time labels + 7 equal day columns.
 * Applied as an inline style so the layout never depends on a generated CSS class.
 */
export const GRID_TEMPLATE_COLUMNS = "4rem repeat(7, minmax(0, 1fr))";

export const slotKey = (day: Day, time: string) => `${day}|${time}`;

export function parseSlotKey(key: string): Slot {
  const [day, time] = key.split("|");
  return { day: day as Day, time };
}

/** Converts stored JSON into a Set of slot keys, dropping anything malformed. */
export function slotsToKeys(slots: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(slots)) return keys;
  for (const slot of slots) {
    if (
      slot &&
      typeof slot === "object" &&
      DAYS.includes((slot as Slot).day) &&
      TIMES.includes((slot as Slot).time)
    ) {
      keys.add(slotKey((slot as Slot).day, (slot as Slot).time));
    }
  }
  return keys;
}

/** Converts a Set of slot keys into sorted JSON for storage. */
export function keysToSlots(keys: Iterable<string>): Slot[] {
  return [...keys]
    .map(parseSlotKey)
    .filter((s) => DAYS.includes(s.day) && TIMES.includes(s.time))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time.localeCompare(b.time));
}

export function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

// ---------- Dates (ISO yyyy-mm-dd strings, calendar math in UTC) ----------

const isoToUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const utcToIso = (date: Date) => date.toISOString().slice(0, 10);

/** Today's calendar date in Denver. */
export function denverToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const date = isoToUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToIso(date);
}

export function mondayOf(iso: string): string {
  const dow = isoToUtc(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

export const currentWeekStart = () => mondayOf(denverToday());

export const weekDates = (weekStart: string) => DAYS.map((_, i) => addDays(weekStart, i));

export function dayLabel(index: number, locale: Locale) {
  return DAY_LABELS[locale][index];
}

export function shortDate(iso: string) {
  const date = isoToUtc(iso);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function formatWeekRange(weekStart: string, locale: Locale) {
  const start = isoToUtc(weekStart);
  const end = isoToUtc(addDays(weekStart, 6));
  const fmt = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** "10:00" → "10:00 AM" / "오전 10:00" */
export function formatTime(time: string, locale: Locale) {
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, "0");
  if (locale === "ko") return `${h < 12 ? "오전" : "오후"} ${hour12}:${mm}`;
  return `${hour12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

export function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  return toHHMM(h * 60 + m + minutes);
}

/** "MDT" or "MST" depending on DST during the given week. */
export function tzAbbreviation(weekStart: string) {
  const noon = new Date(`${addDays(weekStart, 3)}T18:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "short" })
    .formatToParts(noon)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "MT";
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a timestamp in Denver time, e.g. "9월 11일 오후 7:36" / "Sep 11, 7:36 PM".
 * Only numeric parts come from Intl; the words are ours, because ICU builds differ
 * (Node rendered "PM" where browsers render "오후"), which broke hydration.
 */
export function formatTimestamp(timestamp: string, locale: Locale) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  const month = Number(parts.month);
  const day = Number(parts.day);
  const time = formatTime(`${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`, locale);
  return locale === "ko" ? `${month}월 ${day}일 ${time}` : `${MONTHS_EN[month - 1]} ${day}, ${time}`;
}

/**
 * slot key → ids of every student available at that time, in `studentIds` order.
 * Students not in `studentIds` (e.g. the admin) are ignored.
 */
export function groupStudentsBySlot(
  studentIds: readonly string[],
  slotsByUser: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const id of studentIds) {
    for (const key of slotsByUser.get(id) ?? []) {
      const ids = map.get(key);
      if (ids) ids.push(id);
      else map.set(key, [id]);
    }
  }
  return map;
}

export type TimeBlock = { day: Day; start: string; end: string; keys: string[] };

/** Merges slot keys into contiguous blocks per day (e.g. Mon 10:00–11:30). */
export function groupIntoBlocks(keys: Iterable<string>): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const set = new Set(keys);
  for (const day of DAYS) {
    let current: TimeBlock | null = null;
    for (const time of TIMES) {
      const key = slotKey(day, time);
      if (set.has(key)) {
        if (current) {
          current.end = addMinutes(time, STEP_MINUTES);
          current.keys.push(key);
        } else {
          current = { day, start: time, end: addMinutes(time, STEP_MINUTES), keys: [key] };
          blocks.push(current);
        }
      } else {
        current = null;
      }
    }
  }
  return blocks;
}

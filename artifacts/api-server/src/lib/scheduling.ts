import { and, eq } from "drizzle-orm";
import { db, bookingsTable, settingsTable } from "@workspace/db";

type SlotResult = { ok: true } | { ok: false; error: string };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ACTIVE_STATUSES = new Set(["pending", "claimed", "completed"]);
const SESSION_MINUTES = 60;

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const minutes = toMinutes(value);
  return minutes >= 0 && minutes < 24 * 60;
}

function dateDayKey(value: string) {
  return DAY_KEYS[new Date(`${value}T12:00:00Z`).getUTCDay()];
}

function isPastDate(value: string) {
  const today = new Date().toISOString().slice(0, 10);
  return value < today;
}

export async function validateBookingSlot(
  preferredDate: string,
  preferredTime: string,
  options: { excludeBookingId?: number; skipAvailability?: boolean } = {},
): Promise<SlotResult> {
  if (!isValidDate(preferredDate) || !isValidTime(preferredTime)) {
    return { ok: false, error: "Choose a valid appointment date and time." };
  }
  if (isPastDate(preferredDate)) {
    return { ok: false, error: "Choose a future appointment date." };
  }

  const [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) return { ok: true };

  if (!options.skipAvailability) {
    if (
      settings.vacationMode &&
      settings.vacationStart &&
      settings.vacationEnd &&
      preferredDate >= settings.vacationStart &&
      preferredDate <= settings.vacationEnd
    ) {
      return { ok: false, error: "The practice is in vacation mode for that date." };
    }

    const closedDate = settings.closedDates.find((item) => item.date === preferredDate);
    if (closedDate) return { ok: false, error: `The practice is closed: ${closedDate.reason}.` };

    const holiday = settings.holidayHours.find((item) => item.date === preferredDate.slice(5));
    const hours = holiday
      ? holiday.closed
        ? null
        : { open: holiday.open, close: holiday.close }
      : settings.officeHours[dateDayKey(preferredDate)];

    if (!hours || ("closed" in hours && hours.closed)) {
      return { ok: false, error: "The practice is closed on that date." };
    }
    if (toMinutes(preferredTime) < toMinutes(hours.open) || toMinutes(preferredTime) + SESSION_MINUTES > toMinutes(hours.close)) {
      return { ok: false, error: `Appointments must fit within hours of ${hours.open}–${hours.close}.` };
    }
  }

  const existing = await db
    .select({
      id: bookingsTable.id,
      preferredDate: bookingsTable.preferredDate,
      preferredTime: bookingsTable.preferredTime,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.preferredDate, preferredDate)));

  const requestedStart = toMinutes(preferredTime);
  const buffer = settings.bufferMinutes ?? 0;
  const minimumGap = SESSION_MINUTES + buffer;
  const collision = existing.find((booking) => {
    if (booking.id === options.excludeBookingId || !ACTIVE_STATUSES.has(booking.status)) return false;
    return Math.abs(toMinutes(booking.preferredTime) - requestedStart) < minimumGap;
  });

  if (collision) {
    return { ok: false, error: `That time is already booked. Please leave at least ${buffer} minutes between sessions.` };
  }

  return { ok: true };
}
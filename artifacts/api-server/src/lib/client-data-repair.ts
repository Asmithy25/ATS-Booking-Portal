import { eq, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  clientAccountsTable,
  sessionFeedbackTable,
  wellnessAssignmentsTable,
} from "@workspace/db";

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Repairs relationships created by older imports and older booking flows.
 * Phone numbers are the stable client identity used by the booking system.
 * This is intentionally idempotent and safe to run after every client login.
 */
export async function repairClientData(clientAccountId: number, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return { bookingIds: [], repairedBookings: 0, repairedAssignments: 0, repairedFeedback: 0 };

  const allBookings = await db
    .select({ id: bookingsTable.id, phone: bookingsTable.phone, clientAccountId: bookingsTable.clientAccountId })
    .from(bookingsTable);

  const bookingIds = allBookings
    .filter((booking) => normalizePhone(booking.phone) === normalized)
    .map((booking) => booking.id);

  if (!bookingIds.length) {
    return { bookingIds: [], repairedBookings: 0, repairedAssignments: 0, repairedFeedback: 0 };
  }

  const orphanedBookings = allBookings.filter(
    (booking) => bookingIds.includes(booking.id) && booking.clientAccountId !== clientAccountId,
  );
  for (const booking of orphanedBookings) {
    await db.update(bookingsTable).set({ clientAccountId }).where(eq(bookingsTable.id, booking.id));
  }

  const assignments = await db
    .select({ id: wellnessAssignmentsTable.id, bookingId: wellnessAssignmentsTable.bookingId, clientAccountId: wellnessAssignmentsTable.clientAccountId })
    .from(wellnessAssignmentsTable)
    .where(inArray(wellnessAssignmentsTable.bookingId, bookingIds));

  let repairedAssignments = 0;
  for (const assignment of assignments) {
    if (assignment.clientAccountId !== clientAccountId) {
      await db
        .update(wellnessAssignmentsTable)
        .set({ clientAccountId, updatedAt: new Date() })
        .where(eq(wellnessAssignmentsTable.id, assignment.id));
      repairedAssignments += 1;
    }
  }

  const feedback = await db
    .select({ id: sessionFeedbackTable.id, bookingId: sessionFeedbackTable.bookingId, clientAccountId: sessionFeedbackTable.clientAccountId })
    .from(sessionFeedbackTable)
    .where(inArray(sessionFeedbackTable.bookingId, bookingIds));

  let repairedFeedback = 0;
  for (const item of feedback) {
    if (item.clientAccountId !== clientAccountId) {
      await db.update(sessionFeedbackTable).set({ clientAccountId }).where(eq(sessionFeedbackTable.id, item.id));
      repairedFeedback += 1;
    }
  }

  return {
    bookingIds,
    repairedBookings: orphanedBookings.length,
    repairedAssignments,
    repairedFeedback,
  };
}

export async function findClientAccountByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const accounts = await db
    .select({ id: clientAccountsTable.id, phone: clientAccountsTable.phone })
    .from(clientAccountsTable);
  return accounts.find((account) => normalizePhone(account.phone) === normalized) ?? null;
}

export async function repairAllKnownClientLinks() {
  const accounts = await db
    .select({ id: clientAccountsTable.id, phone: clientAccountsTable.phone })
    .from(clientAccountsTable);

  let repairedBookings = 0;
  let repairedAssignments = 0;
  let repairedFeedback = 0;
  for (const account of accounts) {
    const result = await repairClientData(account.id, account.phone);
    repairedBookings += result.repairedBookings;
    repairedAssignments += result.repairedAssignments;
    repairedFeedback += result.repairedFeedback;
  }

  return { accountsChecked: accounts.length, repairedBookings, repairedAssignments, repairedFeedback };
}

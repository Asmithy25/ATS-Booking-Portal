import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Persisted lifecycle for an appointment session. The API creates this table
 * with a foreign key during startup; keep this mapping additive for Drizzle
 * queries and backup/restore support.
 */
export const bookingSessionsTable = pgTable("booking_sessions", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().unique(),
  staffEmail: text("staff_email").notNull(),
  staffName: text("staff_name").notNull(),
  clientName: text("client_name").notNull(),
  confirmationCode: text("confirmation_code").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  autoStarted: boolean("auto_started").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BookingSession = typeof bookingSessionsTable.$inferSelect;

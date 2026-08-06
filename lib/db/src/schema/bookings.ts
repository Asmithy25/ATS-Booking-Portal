import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  clientAccountId: integer("client_account_id"),
  confirmationCode: text("confirmation_code").notNull().unique(),
  clientName: text("client_name").notNull(),
  phone: text("phone").notNull(),
  reason: text("reason").notNull(),
  preferredDate: text("preferred_date").notNull(), // YYYY-MM-DD
  preferredTime: text("preferred_time").notNull(), // HH:MM
  status: text("status").notNull().default("pending"), // pending | claimed | completed | cancelled | no_show
  claimedBy: text("claimed_by"),
  sessionNotes: text("session_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

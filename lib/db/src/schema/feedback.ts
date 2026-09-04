import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const sessionFeedbackTable = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().unique(),
  confirmationCode: text("confirmation_code").notNull(),
  clientAccountId: integer("client_account_id"),
  clientName: text("client_name").notNull(),
  rating: integer("rating").notNull(), // 1 - 5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SessionFeedback = typeof sessionFeedbackTable.$inferSelect;
export type InsertSessionFeedback = typeof sessionFeedbackTable.$inferInsert;

import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const wellnessAssignmentsTable = pgTable("wellness_assignments", {
  id: serial("id").primaryKey(),

  clientAccountId: integer("client_account_id").notNull(),

  bookingId: integer("booking_id"),

  type: text("type").notNull().default("homework"),

  title: text("title").notNull(),

  content: text("content").notNull(),

  dueDate: text("due_date"),

  status: text("status").notNull().default("assigned"),

  createdBy: text("created_by").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WellnessAssignment = typeof wellnessAssignmentsTable.$inferSelect;

export type InsertWellnessAssignment = typeof wellnessAssignmentsTable.$inferInsert;

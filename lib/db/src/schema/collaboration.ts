import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const collaborationItemsTable = pgTable("collaboration_items", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("chat"),
  title: text("title").notNull().default(""),
  body: text("body").notNull(),
  authorName: text("author_name").notNull(),
  assignedTo: text("assigned_to"),
  status: text("status").notNull().default("open"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CollaborationItem = typeof collaborationItemsTable.$inferSelect;
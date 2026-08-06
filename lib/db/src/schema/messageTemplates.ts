import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const messageTemplatesTable = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
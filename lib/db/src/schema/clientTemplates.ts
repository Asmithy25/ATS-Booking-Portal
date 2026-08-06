import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const clientTemplatesTable = pgTable("client_templates", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClientTemplate = typeof clientTemplatesTable.$inferSelect;
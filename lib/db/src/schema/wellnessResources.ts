import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const wellnessResourcesTable = pgTable("wellness_resources", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(),
  url: text("url"),
  isEmergency: boolean("is_emergency").notNull().default(false),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
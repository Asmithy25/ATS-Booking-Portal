import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const clientNotificationsTable = pgTable("client_notifications", {
  id: serial("id").primaryKey(),
  clientAccountId: integer("client_account_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  pushedBy: text("pushed_by").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ClientNotification = typeof clientNotificationsTable.$inferSelect;
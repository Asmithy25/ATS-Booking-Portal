import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const clientAccountsTable = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatesOptIn: boolean("updates_opt_in").notNull().default(false),
});

export type ClientAccount = typeof clientAccountsTable.$inferSelect;
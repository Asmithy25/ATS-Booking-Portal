import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import type { OfficeHours } from "./settings";

export const staffAccountsTable = pgTable("staff_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  officeHours: jsonb("office_hours").notNull().$type<OfficeHours>().default({
    mon: { open: "12:00", close: "23:00", closed: false },
    tue: { open: "12:00", close: "23:00", closed: false },
    wed: { open: "12:00", close: "23:00", closed: false },
    thu: { open: "12:00", close: "23:00", closed: false },
    fri: { open: "12:00", close: "23:00", closed: false },
    sat: { open: "13:00", close: "20:00", closed: false },
    sun: { open: "13:00", close: "20:00", closed: false },
  }),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StaffAccount = typeof staffAccountsTable.$inferSelect;
export type InsertStaffAccount = typeof staffAccountsTable.$inferInsert;

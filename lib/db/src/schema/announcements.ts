import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("client"),
  publishedBy: text("published_by").notNull(),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<AnnouncementMetadata>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
export type AnnouncementMetadata = {
  subheading?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  status?: "draft" | "published" | "archived";
  startsAt?: string;
  endsAt?: string;
  showSignature?: boolean;
  signatureName?: string;
  signatureTitle?: string;
  signatureImageUrl?: string;
};

import { pgTable, serial, boolean, jsonb, text, integer } from "drizzle-orm/pg-core";

export type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type OfficeHours = {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
};

export type HomepageContent = {
  announcementHeading: string;
  announcementSubheading: string;
  announcementDescription: string;
  announcementImageUrl: string;
  heroGreeting: string;
  heroWelcome: string;
  heroQuoteEnabled: boolean;
  heroAcceptingText: string;
  heroPhoneBadge: string;
  heroPrimaryButton: string;
  heroSecondaryText: string;
  heroCardTitle: string;
  heroCardSubtitle: string;
  heroCardDescription: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutParagraph1: string;
  aboutParagraph2: string;
  aboutParagraph3: string;
  aboutQuote: string;
  bookingEyebrow: string;
  bookingTitle: string;
  bookingDescription: string;
  bookingInfoTitle: string;
  bookingPhoneLabel: string;
  bookingPhone: string;
  bookingOfficeBadge: string;
  bookingEmailLabel: string;
  bookingEmail: string;
  bookingHoursTitle: string;
  bookingTherapistHoursTitle: string;
  bookingHolidaysTitle: string;
  bookingFormTitle: string;
  bookingManageLink: string;
  bookingNameLabel: string;
  bookingNamePlaceholder: string;
  bookingPhoneFieldLabel: string;
  bookingPhonePlaceholder: string;
  bookingReasonLabel: string;
  bookingReasonPlaceholder: string;
  bookingDateLabel: string;
  bookingTimeLabel: string;
  bookingDisclaimer: string;
  bookingSubmitText: string;
  bookingSendingText: string;
  bookingSuccessTitle: string;
  bookingSuccessDescription: string;
  bookingCodeLabel: string;
  bookingCodeDescription: string;
  bookingAnotherButton: string;
  bookingClosedTitle: string;
  bookingClosedDescription: string;
  bookingDateHelp: string;
  navPrivateSupport: string;
  navRegion: string;
  navAbout: string;
  navBook: string;
  navWellness: string;
  navStaff: string;
  navClientPortal: string;
  navRequestCall: string;
  footerContactHeading: string;
  footerPracticeHeading: string;
  footerPracticeDescription: string;
  footerCopyrightText: string;
  footerLegalText: string;
  logoAlt: string;
  heroImageUrl: string;
  aboutImageUrl: string;
  faviconUrl: string;
  contactPhone: string;
  contactEmail: string;
};

export type FeatureFlags = {
  clientBooking: boolean;
  clientNotifications: boolean;
  clientUpdatesOptIn: boolean;
  staffRollouts: boolean;
  recognizedBookingCountdown: boolean;
  clientPortalCountdown: boolean;
  clientTemplates: boolean;
};

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  acceptingClients: boolean("accepting_clients").notNull().default(true),
  sessionRequestsOpen: boolean("session_requests_open").notNull().default(true),
  officeHours: jsonb("office_hours").notNull().$type<OfficeHours>(),
  holidayHours: jsonb("holiday_hours").notNull().$type<HolidayHour[]>(),
  closedDates: jsonb("closed_dates").notNull().$type<ClosedDate[]>(),
  bufferMinutes: integer("buffer_minutes").notNull().default(15),
  vacationMode: boolean("vacation_mode").notNull().default(false),
  vacationStart: text("vacation_start"),
  vacationEnd: text("vacation_end"),
  siteName: text("site_name").notNull().default("Ayden's Therapy Services"),
  siteTagline: text("site_tagline").notNull().default("Heal. Grow. Thrive."),
  logoUrl: text("logo_url").notNull().default(""),
  heroTitle: text("hero_title").notNull().default("A safe space for healing and growth."),
  heroDescription: text("hero_description").notNull().default("A warm, grounded space to explore your thoughts and feelings without judgment."),
  primaryColor: text("primary_color").notNull().default("#7B4A2F"),
  secondaryColor: text("secondary_color").notNull().default("#C38A4A"),
  accentColor: text("accent_color").notNull().default("#D9B7A2"),
  homepageContent: jsonb("homepage_content").notNull().$type<HomepageContent>(),
  featureFlags: jsonb("feature_flags").notNull().$type<FeatureFlags>().default({
    clientBooking: true,
    clientNotifications: true,
    clientUpdatesOptIn: true,
    staffRollouts: true,
    recognizedBookingCountdown: true,
    clientPortalCountdown: true,
    clientTemplates: true,
  }),
});

export type HolidayHour = {
  name: string;
  date: string; // MM-DD
  closed: boolean;
  open: string;
  close: string;
};

export type ClosedDate = {
  date: string; // YYYY-MM-DD
  reason: string;
};

export type Settings = typeof settingsTable.$inferSelect;

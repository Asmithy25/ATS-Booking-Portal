# AWS Staff Quick Reference — 3.0

This guide maps the major AWS 3.0 additions to their locations in the staff portal.

## Fastest way to find anything
- Use **Feature Search** in the staff sidebar.
- Shortcut: **Ctrl+K** on Windows/Linux or **⌘K** on Mac.
- Try task phrases such as “live session”, “change logo”, “dark mode”, “backup”, “client”, or a booking confirmation code.
- Search is permission-aware; menu items and results depend on the signed-in staff member's access.

## New and updated features

### Live Session Mode
**Where:** Staff **Home** for “Your ongoing sessions”; **Bookings** for the broader “Live Session Board”.

- Sessions are created for claimed/assigned bookings when the scheduled start time is reached. The server checks about once a minute.
- Use the **End session** button on the session card. Read the confirmation dialog and confirm only when the call/session is actually finished.
- Ending a session marks its booking completed.
- The assigned staff member or founder can end the session. If a scheduled session does not appear, check that the booking is in a claimed status, has an assigned staff member, and its date/time is correct.
- While a live session is active, the app blocks applicable changes to status, assignee, schedule, cancellation, and deletion until the session is ended.
- Florida scheduling uses America/New_York time. Activation is not instantaneous to the second; allow the next scheduler pass (around 60 seconds).

### Feature Search
**Where:** Staff sidebar → **Feature Search**, or **Ctrl+K / ⌘K**.

Searches available feature pages and supported records. It is the best first stop if you cannot remember which menu contains a setting.

### Backup & Recovery Center
**Where:** Founder account → staff sidebar → **Backup & Recovery**.

Available scopes:
- **Bookings** — booking records.
- **Website settings** — site identity and saved configuration.
- **Site data** — bookings, client/staff records, announcements, assignments, feedback, and live-session history.
- **Everything** — all supported records/settings, including audit history.

Click **Download backup** to save a JSON file to your device. To import, choose the JSON file, review the validation/summary and warnings, then confirm the merge. **This is not a full rollback.** Backups can contain sensitive client/business records: store them securely and take a fresh backup before importing.

### Public website branding and Logo Library
**Where:** Founder account → **Website Settings** → **Website & Brand Studio / Brand assets**.

Use this area for client-facing website identity and uploaded logo/brand assets. The Logo Library accepts PNG, JPG, WebP, and ICO images up to 5 MB; SVG uploads are not accepted in the library. Website customization controls affect the public site, not each staff member's personal UI preferences.

### Personal staff appearance
**Where:** Staff sidebar → **My Settings**.

Use My Settings for personal appearance and workspace preferences, including appearance, sidebar, and color customizations. This is separate from the public Website Settings.

### Security
**Where:** Staff sidebar → **Security**.

Use it for available staff sign-in and account-security controls. Access to individual options can depend on role and account configuration.

### Practice Control
**Where:** Staff sidebar → **Practice Control**.

Manage the public-facing practice status/message and any temporary scheduled practice modes.

### Founder Command Center and System Health
**Where:** Search for **Founder Command Center** or **System Health** in Feature Search. These areas may be hidden from staff who do not have access.

### Daily Reset
**Where:** Client-facing website/client experience, in the daily wellness reset area.

Includes a daily affirmation, mood check-in, and small self-care action. Optional reflection text is not sent to staff or persisted by this feature.

## Important distinctions
- **Website Settings** changes public/client-facing brand and website configuration.
- **My Settings** changes the signed-in staff member's own workspace preferences.
- **Backup & Recovery** is founder-only and performs a merge import, not a guaranteed restore-to-an-earlier-moment.
- **Email & SMS delivery** is a separate workstream. Do not treat this release as proof that provider setup or message delivery has been fully tested.
- A browser console can retain older errors after a deploy. After a new release, hard-refresh the portal and look at the newest request in **Developer Tools → Network** before treating an old console entry as current.

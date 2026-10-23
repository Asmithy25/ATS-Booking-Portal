# AWS Portal Changelog

## AWS 3.0 — Halloween / Fall Release
**Release date:** October 23, 2026

### Brand and appearance
- Refreshed the staff workspace with a fall/Halloween-inspired palette: midnight-dark staff surfaces with burnt orange, copper, and amber accents.
- Updated public-site theme defaults and browser theme-color handling.
- Kept staff personal appearance settings separate from public website branding.
- Preserved explicit user-saved colors instead of overwriting custom staff preferences during the theme update.

### Feature Search
- Added a permission-aware staff feature search.
- Open it from **Feature Search** in the staff sidebar or use **Ctrl+K** on Windows/Linux and **⌘K** on Mac.
- Search across available features and pages, plus supported workspace records such as clients, bookings, announcements, staff, and team items.
- Search results respect staff permissions. A feature may not appear for an account that is not allowed to use it.

### Live Session Mode
- Added automatic live-session activation for assigned bookings at their scheduled start time. The server scheduler checks approximately every 60 seconds in the America/New_York time zone and catches up within a limited four-hour window.
- Added an active-session panel to the staff welcome page and a broader Live Session Board on the bookings page.
- Added a confirmation dialog before a session is ended. Ending a session marks it completed.
- Restricted ending a session to its assigned staff member or the founder.
- Added safety guards that block booking status, assignment, time, cancellation, or deletion changes while a session is active, where applicable.
- Added live-session history to supported backup scopes.

### Backup & Recovery
- Added a founder-only Backup & Recovery Center.
- Supports booking-only, website-settings-only, site-data, and everything backup scopes.
- Exports JSON backups directly to the operator's device; no new third-party file-storage service is introduced.
- Validates a selected backup file before import and reports import counts and warnings.
- Recovery uses a **merge** approach. It is not a point-in-time rollback, so take a fresh backup and review the warnings before importing.

### Founder and operational visibility
- Added live-session metrics to the founder overview and surfaced the feature in the staff search catalogue.
- Added searchable entry points for System Health, the founder command center, security, branding, practice controls, analytics, announcements, and other existing staff areas.
- Added a GitHub Actions build check for the AWS 3.0 release.

### Daily Reset
- Added a small client-facing daily wellness reset with an affirmation, mood check-in, and a tiny self-care action.
- Optional reflection text is kept in the current page experience and is not sent to staff or saved by this feature.

### Explicitly not part of this release
- This release does **not** represent a new implementation of the Email & SMS Delivery Center, new provider credentials, or guaranteed delivery of email/SMS notifications. Those remain a separate workstream and should be tested independently.

## AWS 3.0.1 — Render Manifest Hotfix
**Release date:** October 23, 2026

- Changed the Branding Runtime fallback API origin from the retired Railway API URL to the current Render API URL: `https://aws-api-437b.onrender.com`.
- Disabled caching for the active live-session status endpoint and its polling request. Recent logs showed `304 Not Modified` responses; because these responses have no JSON body, the session panel could interpret them as an empty session list.
- Changed the Logo Library API defaults so generated manifest URLs, PWA start/scope URLs, and stored-logo asset URLs default to the current Render API/site origins rather than Railway:
  - API: `https://aws-api-437b.onrender.com`
  - Website: `https://awsbookingportal.onrender.com`
- Preserved `PUBLIC_API_ORIGIN`, `PUBLIC_APP_ORIGIN`, and `VITE_API_URL` as explicit overrides where configured.
- This removes the known hard-coded Railway fallback that caused the browser to request `/api/logo-library/manifest.webmanifest` from the old host and hit a CORS failure.

### Live Session 404 investigation
The source contains `GET /api/bookings/sessions/active`. Recent Render request logs showed repeated **304 Not Modified** responses for that route and no matching 404 in the recent API logs examined. The route was reachable, but a 304 has no JSON body and could be interpreted by the session panel as an empty result. The hotfix disables caching for this poll. If a 404 remains after deploy, hard-refresh the staff portal and inspect the newest Network request (Request URL, status, and response body) so the discrepancy can be reproduced against the active deployment rather than relying on an older console entry.

## Deployment notes
- The Render frontend and API deploy from the `main` branch.
- Frontend: `https://awsbookingportal.onrender.com`
- API: `https://aws-api-437b.onrender.com`
- The API start command currently runs Drizzle's interactive `db push` step before starting the service. The log showed a non-TTY prompt warning on the prior release; review this before the next schema-changing deploy and prefer a non-interactive migration strategy.

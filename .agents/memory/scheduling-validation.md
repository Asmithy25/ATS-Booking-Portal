---
name: Scheduling validation
description: Durable rule for keeping therapy appointment availability consistent across booking and rescheduling flows.
---

Appointment availability is a server-side rule, not only a calendar UI concern. Public booking, staff-created bookings, client rescheduling, and staff rescheduling should all call the same validator so office hours, holiday overrides, one-off closures, vacation windows, session buffers, and double-booking prevention cannot drift between screens.

**Why:** Scheduling controls can be bypassed by direct API requests or by a second client using a different flow. Centralizing the decision prevents conflicting appointments even while the visual calendar evolves.

**How to apply:** When adding a new appointment entry point or changing session duration, buffer behavior, waitlist promotion, or availability settings, update the shared server validator and exercise every booking/rescheduling path before changing only the frontend.
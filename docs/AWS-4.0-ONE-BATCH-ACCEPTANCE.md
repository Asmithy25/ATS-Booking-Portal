# AWS 4.0 — One-Batch Release Acceptance Checklist

**Status:** IN DEVELOPMENT — draft PR. **No phases.** All 45 approved features, the mandatory Staff Logging requirement, and the Therapist → Wellness Staff display-title change must be reviewed together before a single final merge/deployment.

## Approved feature inventory

| # | Feature | Acceptance criteria |
|---|---|---|
| 1 | Corporate Operations Center | Executive-only cross-organization visibility, operational counts and approvals |
| 2 | Executive Approval System | Submissions, approve/deny/revision, and immutable actor history |
| 3 | Corporate Audit Timeline | Timestamped actions with role-restricted audit review |
| 4 | Organizational Chart | Live staff/reporting hierarchy, departments and extensions |
| 5 | Executive Broadcast Center | Audience targeting, acknowledgment tracking and staff notices |
| 6 | My Workday | Upcoming tasks, sessions, alerts and shortcuts |
| 7 | AWS Knowledge Hub | Searchable policies and internal documentation |
| 8 | Smart Shift Exchange | Requests, coverage matches and authorized approval |
| 9 | Internal Help Desk | Tickets, categories, updates and resolutions |
| 10 | Staff Training Academy | Onboarding, lessons, role progress and completion tracking |
| 11 | Wellness Journey Dashboard | Private client goals and progress |
| 12 | Appointment Waitlist | Opt-in queue and notification on matching cancellations |
| 13 | Pre-Session Check-In | Consented client check-ins, minimum necessary clinical access |
| 14 | Secure Client Messaging | Staff permissions and no false real-time response promises |
| 15 | Personal Wellness Library | Resource collection and client bookmarks |
| 16 | Aurora 2.0 | Permission-aware operational assistant with confirmation before writes |
| 17 | AWS Command Palette | Keyboard-first search and navigation |
| 18 | Live Operations Wall | Real-time aggregated operational data without private session detail |
| 19 | AWS Feature Lab | Opt-in trials, staff targeting, safe rollback |
| 20 | Security Command Center | Session management, alerts and permission review |
| 21 | Careers & Recruitment | Public active vacancies, first+last name, phone, email, role application; Founder/Corporate-only edits and decisions |
| 22 | Executive Decision Registry | Searchable decisions, assignees and outcomes |
| 23 | Department Management Studio | Department structure, leaders and staff affiliations |
| 24 | Corporate Policy Publisher | Versioned policies and acknowledgment history |
| 25 | Executive Delegation System | Scoped rights, expiration and audit |
| 26 | Organization Performance Reports | Reviewed aggregate KPIs and schedule |
| 27 | Corporate Change Control | Preview, approval, release and rollback |
| 28 | Staff Profile Studio | Role-accurate profile and editable permitted details |
| 29 | Internal Task Assignment | Assignments, priorities, due dates and progress |
| 30 | Staff Availability & Leave | Employee requests and supervisor decisions |
| 31 | Session Preparation Workspace | Authorized client session preflight |
| 32 | Staff Recognition | Staff milestones and approved recognition |
| 33 | Department Discussion Channels | Correct department access, moderation and retention |
| 34 | Operational Incident Reports | Incident intake, ownership and resolution |
| 35 | Client Onboarding Experience | Guidance, policies and acknowledgment |
| 36 | Appointment Preferences | Account-specific preferences, never presented as guaranteed booking |
| 37 | Wellness Goals & Milestones | Private goals and voluntary completion |
| 38 | Rescheduling Center | Collision-safe date/time changes and policies |
| 39 | Client Feedback Portal | Suggestions and complaints routed appropriately |
| 40 | Accessibility & Comfort | High contrast, reduced motion, larger text and simplified navigation |
| 41 | AWS Notification Center | In-app notices and read/unread tracking |
| 42 | Workflow Builder | Permission-checked, audited trigger/action workflows |
| 43 | Platform Health Monitor | API/database checks and actionable incidents |
| 44 | AWS Mobile Experience | Mobile-first responsiveness and installable web support |
| 45 | Interactive What's New Center | Role-aware release tutorials and acknowledgment |

## Cross-cutting requirements

- **Manual Staff Logging (additional requirement):** every successful staff API mutation produces a pending obligation; staff must manually document it in an immutable record before further writes. Founder/Corporate/audit reviewers can review all permitted logs. The automatic audit trail is preserved.
- **Rename:** all *displayed* occurrences of “Therapist” in role labels should become “Wellness Staff,” without breaking the legacy `therapist` role slug, database schema or existing sessions.
- **Careers:** Founder and ASH Executive are the only roles allowed to modify job postings, view identifiable applicants or approve/deny; an approval does not provision a staff account.
- **Security/privacy:** client and application personal information must not appear in generic workspaces, routing logs or unauthorized queries. Clinical information requires additional review before enabling collection.
- **Deployment:** one coordinated release, only after all checks are completed. Database changes are additive and reversible with a tested backup procedure.

## Current implementation notes

The draft branch introduces a functioning initial AWS 4.0 recruitment module, manual staff log infrastructure, organization workspaces, visible terminology changes and a client preference screen. The generic workspaces **do not yet meet the full specialized acceptance criteria** in this table. Existing AWS 3.x features (appointments, messaging, Aurora, command shortcuts, corporate controls, wellness resources and more) must undergo regression testing against the new changes. A successful build alone is not sufficient to mark any row complete.

## Pre-release checks

- [ ] API and frontend typecheck
- [ ] API and frontend production builds
- [ ] Careers role-based access tests, including denied access from normal staff
- [ ] Careers applicant privacy and retention review
- [ ] Automatic mutation tracking and manual log gate tests
- [ ] Verify manual logs cannot be rewritten or deleted
- [ ] Existing bookings, authentication, client resources and staff settings regression
- [ ] Mobile, screen reader, keyboard, reduced motion and contrast review
- [ ] Production database backup and schema permission check
- [ ] Preview environment walkthrough for Founder, ASH Executive, Wellness Staff and Client
- [ ] Full feature criteria verified; **single release** authorized

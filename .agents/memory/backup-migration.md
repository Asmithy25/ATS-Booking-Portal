---
name: Backup and migration
description: Durable rules for exporting and restoring Ayden portal data safely.
---

Backup and migration is a founder-only operation. Exports are scoped to bookings, site settings, site data, or everything; imports are merge-style and transactional rather than destructive. Login password hashes must never be included in backup files, so account records can only merge into existing accounts by email unless a separate credential-reset flow is added. Preserve serial IDs where possible and reset sequences after importing.

**Why:** These files contain private client and appointment information, while restoring password hashes would create an offline credential-cracking risk. Merge imports reduce the chance that a mistaken upload erases live records, and sequence resets prevent later inserts from colliding with restored IDs.

**How to apply:** Keep backup routes restricted to the founder/admin session, validate the file format and scope before importing, whitelist supported tables/columns, use a database transaction, preserve parent-before-child ordering, and record one audit event for the import rather than generating an audit entry for every restored row.
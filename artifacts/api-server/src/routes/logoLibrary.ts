import { Router, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();
const API_ORIGIN = (process.env.PUBLIC_API_ORIGIN || "https://ats-api-live-production.up.railway.app").replace(/\/+$/, "");
const APP_ORIGIN = (process.env.PUBLIC_APP_ORIGIN || "https://awsbookingportal.up.railway.app").replace(/\/+$/, "");
const MAX_BYTES = 5 * 1024 * 1024;
const CATEGORIES = new Set(["primary", "seasonal", "favicon", "social", "other"]);
const APPLY_TARGETS = new Set(["siteLogo", "favicon", "appleTouchIcon", "pwaIcon"]);
let schemaReady: Promise<void> | null = null;

const rows = <T = Record<string, unknown>>(result: any): T[] => Array.isArray(result) ? result : (result?.rows ?? []);
const assetUrl = (id: number) => API_ORIGIN + "/api/logo-library/assets/" + id;

async function ensureLogoLibrary() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS aws_logo_library (
        id bigserial PRIMARY KEY,
        name text NOT NULL,
        alt_text text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT 'seasonal',
        tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        notes text NOT NULL DEFAULT '',
        mime_type text NOT NULL,
        size_bytes integer NOT NULL,
        data bytea NOT NULL,
        is_public boolean NOT NULL DEFAULT false,
        created_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`));
      await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS idx_aws_logo_library_created ON aws_logo_library(created_at DESC)"));
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function founderOnly(req: Request, res: Response) {
  const access = await getStaffAccess(req);
  if (!access) {
    res.status(401).json({ error: "Sign in to manage brand assets." });
    return null;
  }
  if (access.role !== "founder") {
    res.status(403).json({ error: "Only the AWS founder can manage the Logo Library." });
    return null;
  }
  return access;
}

function imagePayload(dataUrl: unknown): { data: Buffer; mimeType: string } | null {
  if (typeof dataUrl !== "string" || dataUrl.length < 20 || dataUrl.length > 7_200_000) return null;
  const match = /^data:(image\/(?:png|jpeg|webp|x-icon|vnd\.microsoft\.icon));base64,([A-Za-z0-9+/]+=*)$/i.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const encoded = match[2];
  const data = Buffer.from(encoded, "base64");
  if (!data.length || data.length > MAX_BYTES || data.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) return null;

  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const webp = data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  const ico = data.length >= 4 && data[0] === 0 && data[1] === 0 && data[2] === 1 && data[3] === 0;
  const valid = (mimeType === "image/png" && png)
    || (mimeType === "image/jpeg" && jpeg)
    || (mimeType === "image/webp" && webp)
    || ((mimeType === "image/x-icon" || mimeType === "image/vnd.microsoft.icon") && (ico || png));
  if (!valid) return null;
  return { data, mimeType: mimeType === "image/vnd.microsoft.icon" ? "image/x-icon" : mimeType };
}

function safeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().slice(0, 24)).filter(Boolean))].slice(0, 12);
}

function publicAsset(row: any) {
  return {
    id: Number(row.id),
    name: row.name,
    altText: row.altText ?? row.alt_text ?? "",
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    notes: row.notes ?? "",
    mimeType: row.mimeType ?? row.mime_type,
    sizeBytes: Number(row.sizeBytes ?? row.size_bytes),
    isPublic: Boolean(row.isPublic ?? row.is_public),
    createdBy: row.createdBy ?? row.created_by,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    assetUrl: assetUrl(Number(row.id)),
  };
}

async function getSettingsRow() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings ?? null;
}

router.get("/manifest.webmanifest", async (_req, res) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  try {
    const settings = await getSettingsRow();
    const hp = (settings?.homepageContent ?? {}) as Record<string, any>;
    const icon = String(hp.pwaIconUrl || hp.faviconUrl || settings?.logoUrl || APP_ORIGIN + "/favicon.svg").trim();
    let iconType = icon.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
    const logoAssetMatch = /\/api\/logo-library\/assets\/(\d+)(?:\?.*)?$/.exec(icon);
    if (logoAssetMatch) {
      await ensureLogoLibrary();
      const logoAssetId = Number(logoAssetMatch[1]);
      const assetTypeResult = await db.execute(sql`SELECT mime_type AS "mimeType",is_public AS "isPublic" FROM aws_logo_library WHERE id=${logoAssetId} LIMIT 1`);
      const logoAsset = rows(assetTypeResult)[0] as any;
      if (logoAsset?.isPublic && typeof logoAsset.mimeType === "string") iconType = logoAsset.mimeType;
    }
    const manifest = {
      id: APP_ORIGIN + "/",
      name: settings?.siteName || "Aydens Wellness Services",
      short_name: "Aydens Wellness",
      description: "Care That Meets You Where You Are",
      start_url: APP_ORIGIN + "/",
      scope: APP_ORIGIN + "/",
      display: "standalone",
      background_color: "#F7F2E9",
      theme_color: settings?.primaryColor || "#8F4A34",
      icons: icon ? [
        { src: icon, sizes: "any", type: iconType, purpose: "any" },
      ] : [],
    };
    res.json(manifest);
  } catch {
    res.status(200).json({ name: "Aydens Wellness Services", short_name: "Aydens Wellness", start_url: APP_ORIGIN + "/", display: "standalone", theme_color: "#8F4A34", background_color: "#F7F2E9", icons: [] });
  }
});

// All library metadata and uploads are founder-only. Original logo bytes are kept
// in PostgreSQL so files survive deployments and don't depend on local container disk.
router.get("/", requireAuth, async (req, res) => {
  const access = await founderOnly(req, res);
  if (!access) return;
  try {
    await ensureLogoLibrary();
    const result = await db.execute(sql`SELECT id,name,alt_text AS "altText",category,tags,notes,mime_type AS "mimeType",size_bytes AS "sizeBytes",is_public AS "isPublic",created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws_logo_library ORDER BY created_at DESC,id DESC`);
    const settings = await getSettingsRow();
    const hp = (settings?.homepageContent ?? {}) as Record<string, unknown>;
    const activeUrls = new Set([settings?.logoUrl, ...Object.values(hp)].filter((value): value is string => typeof value === "string"));
    res.json(rows(result).map((row) => ({ ...publicAsset(row), isPublic: activeUrls.has(assetUrl(Number((row as any).id))) })));
  } catch (err) {
    req.log.error({ err }, "Logo Library listing failed");
    res.status(500).json({ error: "The Logo Library could not be loaded." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const access = await founderOnly(req, res);
  if (!access) return;
  try {
    await ensureLogoLibrary();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = String(body.name ?? "").trim().slice(0, 80);
    const altText = String(body.altText ?? "").trim().slice(0, 180);
    const category = String(body.category ?? "seasonal");
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    const image = imagePayload(body.dataUrl);
    if (!name) { res.status(400).json({ error: "Give this logo a name first." }); return; }
    if (!CATEGORIES.has(category)) { res.status(400).json({ error: "Choose a valid logo category." }); return; }
    if (!image) { res.status(400).json({ error: "Use a valid PNG, JPG, WebP, or ICO image up to 5 MB. SVG files are not accepted for safety." }); return; }
    const tags = safeTags(body.tags);
    const result = await db.execute(sql`INSERT INTO aws_logo_library (name,alt_text,category,tags,notes,mime_type,size_bytes,data,created_by)
      VALUES (${name},${altText},${category},${JSON.stringify(tags)}::jsonb,${notes},${image.mimeType},${image.data.length},${image.data},${access.email})
      RETURNING id,name,alt_text AS "altText",category,tags,notes,mime_type AS "mimeType",size_bytes AS "sizeBytes",is_public AS "isPublic",created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt"`);
    const asset = rows(result)[0];
    await recordAudit(req, "logo_library_upload", "logo_asset", String(asset.id), "Uploaded " + name);
    res.status(201).json(publicAsset(asset));
  } catch (err) {
    req.log.error({ err }, "Logo Library upload failed");
    res.status(500).json({ error: "The logo could not be saved. Please try again." });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const access = await founderOnly(req, res);
  if (!access) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid logo ID." }); return; }
  try {
    await ensureLogoLibrary();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const currentResult = await db.execute(sql`SELECT id,name,alt_text AS "altText",category,tags,notes,mime_type AS "mimeType",size_bytes AS "sizeBytes",is_public AS "isPublic",created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM aws_logo_library WHERE id=${id} LIMIT 1`);
    const current = rows(currentResult)[0];
    if (!current) { res.status(404).json({ error: "Logo not found." }); return; }
    const name = body.name === undefined ? String(current.name) : String(body.name).trim().slice(0, 80);
    const altText = body.altText === undefined ? String(current.altText ?? "") : String(body.altText).trim().slice(0, 180);
    const category = body.category === undefined ? String(current.category) : String(body.category);
    const notes = body.notes === undefined ? String(current.notes ?? "") : String(body.notes).trim().slice(0, 500);
    const tags = body.tags === undefined ? safeTags(current.tags) : safeTags(body.tags);
    if (!name) { res.status(400).json({ error: "Logo name cannot be empty." }); return; }
    if (!CATEGORIES.has(category)) { res.status(400).json({ error: "Choose a valid logo category." }); return; }
    const image = body.dataUrl === undefined ? null : imagePayload(body.dataUrl);
    if (body.dataUrl !== undefined && !image) { res.status(400).json({ error: "Use a valid PNG, JPG, WebP, or ICO image up to 5 MB." }); return; }
    const updatedResult = image
      ? await db.execute(sql`UPDATE aws_logo_library SET name=${name},alt_text=${altText},category=${category},tags=${JSON.stringify(tags)}::jsonb,notes=${notes},mime_type=${image.mimeType},size_bytes=${image.data.length},data=${image.data},updated_at=now() WHERE id=${id} RETURNING id,name,alt_text AS "altText",category,tags,notes,mime_type AS "mimeType",size_bytes AS "sizeBytes",is_public AS "isPublic",created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt"`)
      : await db.execute(sql`UPDATE aws_logo_library SET name=${name},alt_text=${altText},category=${category},tags=${JSON.stringify(tags)}::jsonb,notes=${notes},updated_at=now() WHERE id=${id} RETURNING id,name,alt_text AS "altText",category,tags,notes,mime_type AS "mimeType",size_bytes AS "sizeBytes",is_public AS "isPublic",created_by AS "createdBy",created_at AS "createdAt",updated_at AS "updatedAt"`);
    await recordAudit(req, image ? "logo_library_replace" : "logo_library_edit", "logo_asset", String(id), "Updated " + name);
    res.json(publicAsset(rows(updatedResult)[0]));
  } catch (err) {
    req.log.error({ err }, "Logo Library update failed");
    res.status(500).json({ error: "The logo could not be updated." });
  }
});

router.post("/:id/apply", requireAuth, async (req, res) => {
  const access = await founderOnly(req, res);
  if (!access) return;
  const id = Number(req.params.id);
  const target = String((req.body as any)?.target ?? "");
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid logo ID." }); return; }
  if (!APPLY_TARGETS.has(target)) { res.status(400).json({ error: "Choose a supported brand placement." }); return; }
  try {
    await ensureLogoLibrary();
    const result = await db.execute(sql`SELECT id,name,alt_text AS "altText" FROM aws_logo_library WHERE id=${id} LIMIT 1`);
    const asset = rows(result)[0];
    if (!asset) { res.status(404).json({ error: "Logo not found." }); return; }
    const settings = await getSettingsRow();
    if (!settings) { res.status(409).json({ error: "Save the site settings once before assigning a logo." }); return; }
    const hp: Record<string, any> = { ...((settings.homepageContent ?? {}) as Record<string, any>), websiteCustomizationEnabled: true };
    const url = assetUrl(id);
    const changes: Record<string, any> = { homepageContent: hp };
    // Bring any legacy defaults forward when branding is first enabled.
    if (/therapy services/i.test(String(settings.siteName || ""))) changes.siteName = "Aydens Wellness Services";
    if (String(settings.siteTagline || "").toLowerCase().replace(/[^a-z]/g, "").includes("healgrowthrive")) changes.siteTagline = "Care That Meets You Where You Are";
    const appliedLabels: Record<string, string> = {
      siteLogo: "main website logo",
      favicon: "browser favicon",
      appleTouchIcon: "Apple touch icon",
      pwaIcon: "installable app icon",
    };
    if (target === "siteLogo") {
      changes.logoUrl = url;
      hp.logoAlt = String(asset.altText || "Aydens Wellness Services").slice(0, 180);
    } else if (target === "favicon") {
      hp.faviconUrl = url;
    } else if (target === "appleTouchIcon") {
      hp.appleTouchIconUrl = url;
    } else if (target === "pwaIcon") {
      hp.pwaIconUrl = url;
    }
    await db.update(settingsTable).set(changes).where(sql`id=${settings.id}`);
    await db.execute(sql`UPDATE aws_logo_library SET is_public=true,updated_at=now() WHERE id=${id}`);
    await recordAudit(req, "logo_library_applied", "logo_asset", String(id), "Applied to " + appliedLabels[target]);
    res.json({ success: true, target, assetUrl: url, message: "Logo applied to " + appliedLabels[target] + "." });
  } catch (err) {
    req.log.error({ err }, "Could not apply logo from Logo Library");
    res.status(500).json({ error: "This logo could not be applied. Please try again." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const access = await founderOnly(req, res);
  if (!access) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid logo ID." }); return; }
  try {
    await ensureLogoLibrary();
    const result = await db.execute(sql`SELECT id,name FROM aws_logo_library WHERE id=${id} LIMIT 1`);
    const asset = rows(result)[0];
    if (!asset) { res.status(404).json({ error: "Logo not found." }); return; }
    const url = assetUrl(id);
    const settings = await getSettingsRow();
    const hp = (settings?.homepageContent ?? {}) as Record<string, unknown>;
    const references = [settings?.logoUrl, ...Object.values(hp)].filter((value) => typeof value === "string") as string[];
    if (references.some((value) => value === url || value.startsWith(url + "?"))) {
      res.status(409).json({ error: "This logo is currently in use. Apply a different logo to that placement before deleting it." });
      return;
    }
    await db.execute(sql`DELETE FROM aws_logo_library WHERE id=${id}`);
    await recordAudit(req, "logo_library_delete", "logo_asset", String(id), "Deleted " + String(asset.name));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Logo Library delete failed");
    res.status(500).json({ error: "The logo could not be deleted." });
  }
});

// Applied logo assets are public, but unused uploads remain private and previews
// require a staff session. These assets are image-only and never contain client files.
router.get("/assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(404).end(); return; }
  try {
    await ensureLogoLibrary();
    const result = await db.execute(sql`SELECT id,mime_type AS "mimeType",data,is_public AS "isPublic" FROM aws_logo_library WHERE id=${id} LIMIT 1`);
    const asset = rows(result)[0] as any;
    if (!asset) { res.status(404).end(); return; }
    const settings = await getSettingsRow();
    const hp = (settings?.homepageContent ?? {}) as Record<string, unknown>;
    const activeUrls = [settings?.logoUrl, ...Object.values(hp)].filter((value): value is string => typeof value === "string");
    const isActiveBrandAsset = activeUrls.includes(assetUrl(id));
    if (!isActiveBrandAsset && !(await getStaffAccess(req))) { res.status(404).end(); return; }
    const data = Buffer.isBuffer(asset.data)
      ? asset.data
      : asset.data instanceof Uint8Array
        ? Buffer.from(asset.data)
        : typeof asset.data === "string" && asset.data.startsWith("\\x")
          ? Buffer.from(asset.data.slice(2), "hex")
          : Buffer.from(asset.data);
    res.setHeader("Content-Type", String(asset.mimeType || "application/octet-stream"));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", asset.isPublic ? "public, no-store" : "private, no-store");
    res.send(data);
  } catch (err) {
    req.log.error({ err }, "Logo asset fetch failed");
    res.status(500).end();
  }
});

export default router;

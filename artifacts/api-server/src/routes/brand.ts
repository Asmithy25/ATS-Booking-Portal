import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getStaffAccess, requireAuth } from "../middleware/auth";
import { recordAudit } from "../lib/audit";

const router = Router();
const exec = (query: string) => db.execute(sql.raw(query));
type Row = Record<string, any>;
const rows = <T extends Row = Row>(result: any): T[] => Array.isArray(result) ? result : (result?.rows ?? []);
const clean = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const q = (value: unknown) => value === null || value === undefined ? "NULL" : "'" + String(value).replace(/'/g, "''") + "'";
const qJson = (value: unknown) => q(JSON.stringify(value ?? [])) + "::jsonb";

const SLOT_COLUMNS = {
  siteLogoId: "site_logo_asset_id",
  staffLogoId: "staff_logo_asset_id",
  clientLogoId: "client_logo_asset_id",
  faviconId: "favicon_asset_id",
  appleTouchIconId: "apple_touch_icon_asset_id",
  pwaIconId: "pwa_icon_asset_id",
} as const;
const SLOT_LABELS: Record<string, string> = {
  siteLogoId: "Public website logo",
  staffLogoId: "Staff workspace logo",
  clientLogoId: "Client portal logo",
  faviconId: "Browser favicon",
  appleTouchIconId: "Apple touch icon",
  pwaIconId: "Installable app icon",
};

let ready: Promise<void> | null = null;
async function ensureBrandStorage() {
  if (!ready) {
    ready = (async () => {
      await exec("CREATE TABLE IF NOT EXISTS aws_brand_assets (id serial PRIMARY KEY,name text NOT NULL,original_filename text NOT NULL,mime_type text NOT NULL,size_bytes integer NOT NULL,tags jsonb NOT NULL DEFAULT '[]'::jsonb,data bytea NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())");
      await exec("CREATE INDEX IF NOT EXISTS idx_aws_brand_assets_updated ON aws_brand_assets(updated_at DESC)");
      await exec("CREATE TABLE IF NOT EXISTS aws_brand_settings (id integer PRIMARY KEY DEFAULT 1,site_logo_asset_id integer,staff_logo_asset_id integer,client_logo_asset_id integer,favicon_asset_id integer,apple_touch_icon_asset_id integer,pwa_icon_asset_id integer,updated_by text,updated_at timestamptz NOT NULL DEFAULT now())");
      await exec("INSERT INTO aws_brand_settings(id,updated_at) VALUES (1,now()) ON CONFLICT(id) DO NOTHING");
    })().catch((error) => { ready = null; throw error; });
  }
  await ready;
}

async function requireFounder(req: Request, res: Response) {
  const access = await getStaffAccess(req);
  if (!access) { res.status(401).json({ error: "Sign in to the staff workspace first." }); return null; }
  if (access.role !== "founder") { res.status(403).json({ error: "Founder access is required to manage brand assets." }); return null; }
  return access;
}

function assetUrl(id: unknown) {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? "/api/brand/assets/" + value + "/file" : "";
}

function detectImageType(data: Buffer) {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const signature = data.toString("ascii", 0, 6);
  if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  return "";
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => clean(tag, 28).replace(/[^\p{L}\p{N} _-]/gu, "")).filter(Boolean))].slice(0, 12);
}

async function readBrandSettings() {
  return rows(await exec("SELECT * FROM aws_brand_settings WHERE id=1 LIMIT 1"))[0] ?? {};
}

async function publicBrandPayload() {
  await ensureBrandStorage();
  const settings = await readBrandSettings();
  const ids = [
    ["siteLogo", settings.site_logo_asset_id],
    ["staffLogo", settings.staff_logo_asset_id],
    ["clientLogo", settings.client_logo_asset_id],
    ["favicon", settings.favicon_asset_id],
    ["appleTouchIcon", settings.apple_touch_icon_asset_id],
    ["pwaIcon", settings.pwa_icon_asset_id],
  ] as const;
  const output: Record<string, unknown> = { updatedAt: settings.updated_at ?? null };
  for (const [key, id] of ids) {
    const url = assetUrl(id);
    output[key + "Url"] = url;
    output[key + "Id"] = id ?? null;
    output[key + "MimeType"] = "";
    if (id && url) {
      const asset = rows<{ mimeType: string }>(await exec("SELECT mime_type AS \"mimeType\" FROM aws_brand_assets WHERE id=" + Number(id) + " LIMIT 1"))[0];
      output[key + "MimeType"] = asset?.mimeType ?? "";
    }
  }
  return output;
}

// Public settings deliberately expose only the assets explicitly assigned to a public branding slot.
router.get("/public-settings", async (_req, res) => {
  try { res.setHeader("Cache-Control", "no-store"); res.json(await publicBrandPayload()); }
  catch (error) { res.status(500).json({ error: "Brand settings are temporarily unavailable." }); }
});

router.get("/manifest.webmanifest", async (req, res) => {
  try {
    const brand = await publicBrandPayload();
    const appOrigin = String(process.env.PUBLIC_APP_ORIGIN || "https://awsbookingportal.up.railway.app").replace(/\/$/, "");
    const icons: Array<Record<string, string>> = [];
    const pwa = String(brand.pwaIconUrl || "");
    if (pwa) icons.push({ src: pwa, sizes: "any", type: String(brand.pwaIconMimeType || "image/png"), purpose: "any maskable" });
    else icons.push({ src: appOrigin + "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" });
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: appOrigin + "/",
      name: "Aydens Wellness Services",
      short_name: "Aydens",
      description: "Care That Meets You Where You Are",
      start_url: appOrigin + "/",
      scope: appOrigin + "/",
      display: "standalone",
      background_color: "#f8f5ee",
      theme_color: "#315347",
      icons,
    });
  } catch {
    res.status(500).json({ error: "The app manifest is temporarily unavailable." });
  }
});

// Private library metadata: never return original files or unassigned assets from a public route.
router.get("/assets", requireAuth, async (req, res) => {
  const access = await requireFounder(req, res); if (!access) return;
  await ensureBrandStorage();
  const settings = await readBrandSettings();
  const used: Record<number, string[]> = {};
  for (const [slot, column] of Object.entries(SLOT_COLUMNS)) {
    const id = Number(settings[column]);
    if (id) (used[id] ??= []).push(SLOT_LABELS[slot]);
  }
  const assets = rows(await exec("SELECT id,name,original_filename AS \"originalFilename\",mime_type AS \"mimeType\",size_bytes AS \"sizeBytes\",tags,created_by AS \"createdBy\",created_at AS \"createdAt\",updated_at AS \"updatedAt\" FROM aws_brand_assets ORDER BY updated_at DESC,id DESC"));
  res.setHeader("Cache-Control", "no-store");
  res.json(assets.map((asset) => ({ ...asset, fileUrl: assetUrl(asset.id), usedIn: used[Number(asset.id)] ?? [] })));
});

router.post("/assets", requireAuth, async (req, res) => {
  const access = await requireFounder(req, res); if (!access) return;
  try {
    await ensureBrandStorage();
    const filename = clean(req.body?.fileName, 180) || "aws-brand-asset";
    const suppliedMime = clean(req.body?.mimeType, 60).toLowerCase();
    const encoded = String(req.body?.data ?? "");
    if (!encoded || encoded.length > 7_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      res.status(400).json({ error: "Choose an image smaller than 5 MB." }); return;
    }
    const data = Buffer.from(encoded, "base64");
    if (!data.length || data.length > 5 * 1024 * 1024) { res.status(413).json({ error: "Brand images must be 5 MB or smaller." }); return; }
    const actualMime = detectImageType(data);
    if (!actualMime || actualMime !== suppliedMime) {
      res.status(400).json({ error: "This image could not be verified. Use a PNG, JPG, WebP, or GIF image." }); return;
    }
    const providedName = clean(req.body?.name, 100);
    const fallbackName = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const name = providedName || fallbackName || "Brand asset";
    const tags = normalizeTags(req.body?.tags);
    const inserted = rows<{ id: number; name: string; mimeType: string; sizeBytes: number }>(await exec(
      "INSERT INTO aws_brand_assets(name,original_filename,mime_type,size_bytes,tags,data,created_by,created_at,updated_at) VALUES (" +
      q(name) + "," + q(filename) + "," + q(actualMime) + "," + data.length + "," + qJson(tags) +
      ",decode(" + q(data.toString("base64")) + ",'base64')," + q(access.email) + ",now(),now()) RETURNING id,name,mime_type AS \"mimeType\",size_bytes AS \"sizeBytes\""
    ))[0];
    await recordAudit(req, "uploaded_brand_asset", "brand_asset", String(inserted.id), name + " · " + actualMime + " · " + data.length + " bytes");
    res.status(201).json({ ...inserted, fileUrl: assetUrl(inserted.id), tags, usedIn: [] });
  } catch (error) {
    req.log?.error?.({ error }, "Brand asset upload failed");
    res.status(500).json({ error: "The image could not be saved. Please try again." });
  }
});

router.patch("/assets/:id", requireAuth, async (req, res) => {
  const access = await requireFounder(req, res); if (!access) return;
  await ensureBrandStorage();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid asset." }); return; }
  const existing = rows(await exec("SELECT id FROM aws_brand_assets WHERE id=" + id + " LIMIT 1"))[0];
  if (!existing) { res.status(404).json({ error: "Brand asset not found." }); return; }
  const name = req.body?.name === undefined ? undefined : clean(req.body.name, 100);
  if (name !== undefined && !name) { res.status(400).json({ error: "Give this asset a name." }); return; }
  const tags = req.body?.tags === undefined ? undefined : normalizeTags(req.body.tags);
  const updates: string[] = [];
  if (name !== undefined) updates.push("name=" + q(name));
  if (tags !== undefined) updates.push("tags=" + qJson(tags));
  if (!updates.length) { res.status(400).json({ error: "There are no changes to save." }); return; }
  updates.push("updated_at=now()");
  const updated = rows(await exec("UPDATE aws_brand_assets SET " + updates.join(",") + " WHERE id=" + id + " RETURNING id,name,original_filename AS \"originalFilename\",mime_type AS \"mimeType\",size_bytes AS \"sizeBytes\",tags,created_at AS \"createdAt\",updated_at AS \"updatedAt\""))[0];
  await recordAudit(req, "updated_brand_asset", "brand_asset", String(id), name ?? "Updated tags");
  res.json({ ...updated, fileUrl: assetUrl(id) });
});

router.delete("/assets/:id", requireAuth, async (req, res) => {
  const access = await requireFounder(req, res); if (!access) return;
  await ensureBrandStorage();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid asset." }); return; }
  const settings = await readBrandSettings();
  const assigned = Object.entries(SLOT_COLUMNS).filter(([, column]) => Number(settings[column]) === id).map(([slot]) => SLOT_LABELS[slot]);
  if (assigned.length) { res.status(409).json({ error: "This logo is currently used as " + assigned.join(", ") + ". Choose a replacement for those slots before deleting it." }); return; }
  const asset = rows<{ name: string }>(await exec("DELETE FROM aws_brand_assets WHERE id=" + id + " RETURNING name"))[0];
  if (!asset) { res.status(404).json({ error: "Brand asset not found." }); return; }
  await recordAudit(req, "deleted_brand_asset", "brand_asset", String(id), asset.name);
  res.json({ success: true });
});

router.put("/settings", requireAuth, async (req, res) => {
  const access = await requireFounder(req, res); if (!access) return;
  try {
    await ensureBrandStorage();
    const current = await readBrandSettings();
    const next: Record<string, number | null> = {};
    for (const [key, column] of Object.entries(SLOT_COLUMNS)) {
      const value = req.body?.[key];
      if (value === undefined) { next[column] = current[column] == null ? null : Number(current[column]); continue; }
      if (value === null || value === "") { next[column] = null; continue; }
      const id = Number(value);
      if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "One of the selected assets is invalid." }); return; }
      const exists = rows(await exec("SELECT id FROM aws_brand_assets WHERE id=" + id + " LIMIT 1"))[0];
      if (!exists) { res.status(400).json({ error: "One of the selected assets no longer exists. Refresh the library and try again." }); return; }
      next[column] = id;
    }
    await exec("UPDATE aws_brand_settings SET site_logo_asset_id=" + (next.site_logo_asset_id ?? "NULL") +
      ",staff_logo_asset_id=" + (next.staff_logo_asset_id ?? "NULL") +
      ",client_logo_asset_id=" + (next.client_logo_asset_id ?? "NULL") +
      ",favicon_asset_id=" + (next.favicon_asset_id ?? "NULL") +
      ",apple_touch_icon_asset_id=" + (next.apple_touch_icon_asset_id ?? "NULL") +
      ",pwa_icon_asset_id=" + (next.pwa_icon_asset_id ?? "NULL") +
      ",updated_by=" + q(access.email) + ",updated_at=now() WHERE id=1");
    await recordAudit(req, "updated_brand_settings", "brand_settings", "1", "Brand library slot assignments changed");
    res.json(await publicBrandPayload());
  } catch (error) {
    req.log?.error?.({ error }, "Brand settings update failed");
    res.status(500).json({ error: "Brand settings could not be saved." });
  }
});

// Selected logo assets are intentionally public; all other originals require founder authentication.
router.get("/assets/:id/file", async (req, res) => {
  try {
    await ensureBrandStorage();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid asset." }); return; }
    const settings = await readBrandSettings();
    const publicIds = Object.values(SLOT_COLUMNS).map((column) => Number(settings[column])).filter(Boolean);
    if (!publicIds.includes(id)) {
      const access = await getStaffAccess(req);
      if (!access || access.role !== "founder") { res.status(404).json({ error: "Asset not found." }); return; }
    }
    const asset = rows<{ name: string; mimeType: string; fileName: string; data: Buffer }>(await exec(
      "SELECT name,mime_type AS \"mimeType\",original_filename AS \"fileName\",data FROM aws_brand_assets WHERE id=" + id + " LIMIT 1"
    ))[0];
    if (!asset) { res.status(404).json({ error: "Asset not found." }); return; }
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline; filename=\"" + clean(asset.fileName, 120).replace(/["\\\\]/g, "_") + "\"");
    res.setHeader("Cache-Control", publicIds.includes(id) ? "public, max-age=300" : "private, no-store");
    res.send(asset.data);
  } catch {
    res.status(500).json({ error: "The image could not be retrieved." });
  }
});

export default router;

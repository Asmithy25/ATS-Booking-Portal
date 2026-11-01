import { useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";

const FALLBACK_API_ORIGIN = "https://aws-api-437b.onrender.com";
const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
function hslFromHex(color: string) {
  const hex = isHex(color) ? color : "#8F4A34";
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const light = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(light * 100)}%`;
}
function foregroundFor(hex: string) {
  const value = isHex(hex) ? hex : "#8F4A34";
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 0.56 ? "0 0% 9%" : "0 0% 100%";
}


function syncLink(rel: string, href: string, type?: string, crossOrigin?: "anonymous" | "use-credentials") {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
  else link.removeAttribute("type");
  if (crossOrigin) link.crossOrigin = crossOrigin;
  else link.removeAttribute("crossorigin");
}

export default function BrandingRuntime() {
  const { data: settings } = useGetSettings();

  useEffect(() => {
    if (!settings) return;
    const content = (settings as any).homepageContent ?? {};
    const logo = typeof settings.logoUrl === "string" ? settings.logoUrl : "";
    const favicon = String(content.faviconUrl || logo || "/favicon.svg");
    const touchIcon = String(content.appleTouchIconUrl || content.pwaIconUrl || "");
    const apiOrigin = String(import.meta.env.VITE_API_URL || FALLBACK_API_ORIGIN).replace(/\/+$/, "");

    syncLink("icon", favicon, favicon.endsWith(".svg") ? "image/svg+xml" : undefined);
    if (touchIcon) {
      syncLink("apple-touch-icon", touchIcon);
    } else {
      document.querySelector('link[rel="apple-touch-icon"]')?.remove();
    }
    syncLink("manifest", apiOrigin + "/api/logo-library/manifest.webmanifest", undefined, "anonymous");
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    // The website-level palette is the shared design system across public, client and staff.
    // Staff shell can still choose a separate appearance (light/dark), not a separate season.
    const sharedColors = {
      primary: String(settings.primaryColor || "#8F4A34"),
      secondary: String(settings.secondaryColor || "#B58C50"),
      accent: String(settings.accentColor || "#C4CEB5"),
    };
    const root = document.documentElement;
    for (const [name, color] of Object.entries(sharedColors)) {
      if (!isHex(color)) continue;
      root.style.setProperty("--" + name, hslFromHex(color));
      root.style.setProperty("--" + name + "-foreground", foregroundFor(color));
    }
    root.style.setProperty("--ring", hslFromHex(sharedColors.primary));
    const configuredPrimary = String(settings.primaryColor || "").trim();
    themeMeta.content = isHex(configuredPrimary)
      ? configuredPrimary
      : "#8F4A34";
    document.title = settings.siteName || "Aydens Wellness Services";
  }, [settings]);

  return null;
}

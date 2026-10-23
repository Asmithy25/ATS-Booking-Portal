import { useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";

const FALLBACK_API_ORIGIN = "https://ats-api-live-production.up.railway.app";

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
    const configuredPrimary = String(settings.primaryColor || "").trim();
    themeMeta.content = /^#[\\da-f]{6}$/i.test(configuredPrimary) && configuredPrimary.toLowerCase() !== "#8f4a34"
      ? configuredPrimary
      : "#C85E09";
    document.title = settings.siteName || "Aydens Wellness Services";
  }, [settings]);

  return null;
}

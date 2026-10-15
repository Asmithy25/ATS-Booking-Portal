import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { customFetch } from "@workspace/api-client-react";

export type PublicBranding = {
  siteLogoUrl: string;
  staffLogoUrl: string;
  clientLogoUrl: string;
  faviconUrl: string;
  appleTouchIconUrl: string;
  pwaIconUrl: string;
  faviconMimeType: string;
  appleTouchIconMimeType: string;
  pwaIconMimeType: string;
  updatedAt?: string | null;
};

const emptyBranding: PublicBranding = {
  siteLogoUrl: "",
  staffLogoUrl: "",
  clientLogoUrl: "",
  faviconUrl: "",
  appleTouchIconUrl: "",
  pwaIconUrl: "",
  faviconMimeType: "",
  appleTouchIconMimeType: "",
  pwaIconMimeType: "",
};

const BrandContext = createContext<PublicBranding>(emptyBranding);
const apiOrigin = String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export function resolveBrandAssetUrl(value?: string | null) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(url)) return url;
  if (url.startsWith("/api/") && apiOrigin) return apiOrigin + url;
  return url;
}

function upsertLink(rel: string, href: string, type?: string, sizes?: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="' + rel + '"]');
  if (!href) {
    if (link && rel !== "icon") link.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
  if (sizes) link.sizes = sizes;
}

function BrandHead({ branding }: { branding: PublicBranding }) {
  useEffect(() => {
    const favicon = resolveBrandAssetUrl(branding.faviconUrl) || "/favicon.svg";
    upsertLink("icon", favicon, branding.faviconMimeType || (favicon.endsWith(".svg") ? "image/svg+xml" : undefined));
    upsertLink("apple-touch-icon", resolveBrandAssetUrl(branding.appleTouchIconUrl), branding.appleTouchIconMimeType || undefined, "180x180");
    const manifest = (apiOrigin || "") + "/api/brand/manifest.webmanifest";
    upsertLink("manifest", manifest, "application/manifest+json");
    let theme = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.content = "#315347";
  }, [branding]);
  return null;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PublicBranding>(emptyBranding);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      customFetch<PublicBranding>("/api/brand/public-settings", { responseType: "json" })
        .then((result) => { if (mounted && result && typeof result === "object") setBranding({ ...emptyBranding, ...result }); })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("aws-branding-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("aws-branding-updated", refresh);
    };
  }, []);
  return <BrandContext.Provider value={branding}><BrandHead branding={branding} />{children}</BrandContext.Provider>;
}

export function useBranding() {
  return useContext(BrandContext);
}

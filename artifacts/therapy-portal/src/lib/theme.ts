import type React from 'react';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALL_THEME = {
  primary: '#C85E09',
  secondary: '#F3A444',
  accent: '#5C2B12',
};

function preserveCustomOrUseHalloween(value: string | undefined, previousDefault: string, halloweenDefault: string) {
  if (!value || !HEX_COLOR.test(value) || value.toLowerCase() === previousDefault.toLowerCase()) {
    return halloweenDefault;
  }
  return value;
}

export function hexToHslValue(value: string, fallback: string): string {
  const hex = HEX_COLOR.test(value) ? value : fallback;
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function getThemeStyle(settings?: {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}): React.CSSProperties {
  const primary = preserveCustomOrUseHalloween(settings?.primaryColor, '#8F4A34', FALL_THEME.primary);
  const secondary = preserveCustomOrUseHalloween(settings?.secondaryColor, '#B58C50', FALL_THEME.secondary);
  const accent = preserveCustomOrUseHalloween(settings?.accentColor, '#C4CEB5', FALL_THEME.accent);
  return {
    '--primary': hexToHslValue(primary, '22 91% 41%'),
    '--secondary': hexToHslValue(secondary, '35 86% 61%'),
    '--accent': hexToHslValue(accent, '22 67% 22%'),
    '--ring': hexToHslValue(primary, '22 91% 41%'),
  } as React.CSSProperties;
}

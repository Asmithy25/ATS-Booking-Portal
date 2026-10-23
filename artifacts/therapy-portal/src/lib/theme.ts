import type React from 'react';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALL_THEME = {
  primary: '#C85E09',
  secondary: '#F3A444',
  accent: '#F2C078',
};

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
  const savedPrimary = settings?.primaryColor;
  const savedSecondary = settings?.secondaryColor;
  const savedAccent = settings?.accentColor;
  const primary = savedPrimary && HEX_COLOR.test(savedPrimary) && !['#8F4A34', '#7B4A2F'].includes(savedPrimary.toUpperCase()) ? savedPrimary : FALL_THEME.primary;
  const secondary = savedSecondary && HEX_COLOR.test(savedSecondary) && !['#B58C50', '#C38A4A'].includes(savedSecondary.toUpperCase()) ? savedSecondary : FALL_THEME.secondary;
  const accent = savedAccent && HEX_COLOR.test(savedAccent) && !['#C4CEB5', '#D9B7A2'].includes(savedAccent.toUpperCase()) ? savedAccent : FALL_THEME.accent;
  return {
    '--primary': hexToHslValue(primary, '22 91% 41%'),
    '--secondary': hexToHslValue(secondary, '35 86% 61%'),
    '--accent': hexToHslValue(accent, '36 82% 72%'),
    '--ring': hexToHslValue(primary, '22 91% 41%'),
  } as React.CSSProperties;
}

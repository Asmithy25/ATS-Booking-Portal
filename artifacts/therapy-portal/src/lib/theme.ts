import type React from 'react';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALL_THEME = {
  primary: '#7B4A2F',
  secondary: '#C38A4A',
  accent: '#D9B7A2',
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
  return {
    '--primary': hexToHslValue(settings?.primaryColor ?? '#7B4A2F', '18 55% 40%'),
    '--secondary': hexToHslValue(settings?.secondaryColor ?? FALL_THEME.secondary, '35 45% 56%'),
    '--accent': hexToHslValue(settings?.accentColor ?? FALL_THEME.accent, '75 18% 84%'),
    '--ring': hexToHslValue(settings?.primaryColor ?? '#7B4A2F', '18 55% 40%'),
  } as React.CSSProperties;
}
"use client";

import { Facehash } from "facehash";

const DEFAULT_COLORS = [
  "oklch(0.7 0.24 0)",
  "oklch(0.7 0.24 30)",
  "oklch(0.7 0.24 60)",
  "oklch(0.7 0.24 90)",
  "oklch(0.7 0.24 120)",
  "oklch(0.7 0.24 150)",
  "oklch(0.7 0.24 180)",
  "oklch(0.7 0.24 210)",
  "oklch(0.7 0.24 240)",
  "oklch(0.7 0.24 270)",
  "oklch(0.7 0.24 300)",
  "oklch(0.7 0.24 330)"
];

/**
 * Reusable Facehash avatar component.
 *
 * @param {string}  name      - Display name or username used to generate the face hash
 * @param {string}  [color]   - facehash_color from the user's profile (oklch string)
 * @param {number}  [size=32] - Pixel size (width & height)
 * @param {string}  [className] - Additional CSS classes
 */
export default function FacehashAvatar({
  name,
  color,
  size = 32,
  className = ""
}) {
  return (
    <Facehash
      name={name || "user"}
      size={size}
      variant="solid"
      enableBlink
      className={`rounded-full text-black shrink-0 ${className}`.trim()}
      colors={color ? [color] : DEFAULT_COLORS}
    />
  );
}

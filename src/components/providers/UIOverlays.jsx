"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import CRTOverlay from "@/components/providers/CRTOverlay";

export default function UIOverlays() {
  const { profile } = useAuth();
  const s = profile?.ui_settings ?? {};
  const showNoise = s.noise !== false;
  // The CRT shader stripes text, so it's opt-in; paper grain stays on unless
  // turned off.
  const showCrt = s.crt === true;

  return (
    <>
      {showNoise && (
        <div aria-hidden="true" className="noise-overlay z-[9999]" />
      )}
      {showCrt && <CRTOverlay />}
    </>
  );
}

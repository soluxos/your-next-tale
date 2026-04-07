"use client";

import { useAuth } from "@/components/providers/AuthProvider";

export default function UIOverlays() {
  const { profile } = useAuth();
  const s = profile?.ui_settings ?? {};
  const showNoise = s.noise !== false;
  const showCrt = s.crt !== false;

  return (
    <>
      {showNoise && (
        <div aria-hidden="true" className="noise-overlay z-[9999]" />
      )}
      {showCrt && (
        <div aria-hidden="true" className="scanlines-overlay z-[9999]" />
      )}
    </>
  );
}

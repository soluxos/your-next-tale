"use client";

import { useState } from "react";

export default function PasswordInput({ id, name = "password", autoComplete, minLength, describedBy }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        className="field w-full pr-16"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-[6px] label text-textSecondary hover:text-ink hover:bg-paper-3"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

"use client";

import { cloneElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import { FormMessage } from "@/components/pages/auth/AuthShell";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

// Same palette FacehashAvatar falls back to, named for people rather than oklch.
const AVATAR_COLOURS = [
  ["Pink", "oklch(0.7 0.24 0)"],
  ["Red", "oklch(0.7 0.24 30)"],
  ["Orange", "oklch(0.7 0.24 60)"],
  ["Gold", "oklch(0.7 0.24 90)"],
  ["Lime", "oklch(0.7 0.24 120)"],
  ["Green", "oklch(0.7 0.24 150)"],
  ["Teal", "oklch(0.7 0.24 180)"],
  ["Sky", "oklch(0.7 0.24 210)"],
  ["Blue", "oklch(0.7 0.24 240)"],
  ["Violet", "oklch(0.7 0.24 270)"],
  ["Purple", "oklch(0.7 0.24 300)"],
  ["Magenta", "oklch(0.7 0.24 330)"]
];

const MIN_PASSWORD = 8;
const EMPTY_FORM = { fullName: "", username: "", website: "", isPrivate: false, facehashColor: null };

const toForm = (p) => ({
  fullName: p?.full_name || "",
  username: p?.username || "",
  website: p?.website || "",
  isPrivate: p?.is_private ?? false,
  facehashColor: p?.facehash_color || null
});

const sameForm = (a, b) => Object.keys(EMPTY_FORM).every((k) => a[k] === b[k]);

export default function UserSettings({ user: serverUser, initialProfile = null, initialTab = "profile" }) {
  // Stable supabase client — never recreate across renders
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const { user: clientUser, loading: authLoading, refreshProfile } = useAuth();

  // Prefer the live client-side user (handles first-time email confirmation
  // where the server prop may be stale before the cookie is hydrated)
  const user = clientUser ?? serverUser;

  const [tab, setTab] = useState(initialTab);
  // `saved` is what's in the database; null until the profile has loaded
  const [saved, setSaved] = useState(() => (initialProfile ? toForm(initialProfile) : null));
  const [form, setForm] = useState(() => saved ?? EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const loading = !saved;

  // Fallback when the server couldn't see the session yet
  useEffect(() => {
    if (saved || authLoading || !user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, username, website, is_private, facehash_color")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Error loading profile:", error);
        const loaded = toForm(data);
        setSaved(loaded);
        setForm(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, [saved, authLoading, user?.id, supabase]);

  const changeTab = (value) => {
    setTab(value);
    // Keep ?tab= in the URL so a refresh (or a shared link) lands here
    const url = new URL(window.location.href);
    if (value === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState(window.history.state, "", url);
  };

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (status === "saved") setStatus("idle");
    // Re-check a field that's showing an error so it clears as soon as it's fixed
    if (errors[key]) setErrors((e) => ({ ...e, [key]: validateField(key, value, saved), form: undefined }));
  };

  const dirty = !!saved && !sameForm(form, saved);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.id || !dirty) return;

    const next = {
      ...form,
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      // Only tidy the website if they touched it
      website: form.website === saved.website ? saved.website : normaliseWebsite(form.website)
    };
    const found = {};
    for (const key of ["username", "website"]) {
      const message = validateField(key, next[key], saved);
      if (message) found[key] = message;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setStatus("saving");
    try {
      // Check first so the common case gets a friendly message; the unique
      // constraint below still catches a race.
      if (next.username !== saved.username) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", next.username)
          .neq("id", user.id)
          .limit(1);
        if (taken?.length) throw { code: "23505" };
      }

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: next.fullName,
        username: next.username,
        website: next.website,
        is_private: next.isPrivate,
        facehash_color: next.facehashColor,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setSaved(next);
      setForm(next);
      setStatus("saved");
      refreshProfile();
    } catch (error) {
      setStatus("idle");
      if (isUniqueViolation(error)) {
        setErrors({ username: "That username is taken" });
        document.getElementById("username")?.focus();
      } else {
        setErrors({ form: `Couldn’t save your profile. ${error?.message || "Please try again."}` });
      }
    }
  };

  if (!authLoading && !user) {
    return (
      <SettingsFrame>
        <div className="card p-6 sm:p-8 flex flex-col items-start gap-4">
          <p className="font-ppMondwest text-[17px] text-textPrimary">Sign in to change your profile and password.</p>
          <Link href="/login?next=/account" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </SettingsFrame>
    );
  }

  const bookcaseHref = saved?.username ? `/u/${encodeURIComponent(saved.username)}` : null;
  const displayName = form.fullName || form.username;

  return (
    <SettingsFrame bookcaseHref={bookcaseHref}>
      <TabsPrimitive.Root value={tab} onValueChange={changeTab}>
        <div className="border-b border-line mb-6 sm:mb-8">
          <TabsPrimitive.List aria-label="Settings" className="grid grid-cols-2 sm:flex sm:gap-8">
            <TabTrigger value="profile">Profile</TabTrigger>
            <TabTrigger value="password">Password</TabTrigger>
          </TabsPrimitive.List>
        </div>

        <TabsPrimitive.Content value="profile" className="outline-none">
          <form onSubmit={handleSaveProfile} noValidate className="flex flex-col gap-5 sm:gap-6">
            <Section title="Avatar" description="Your face is generated from your name. Pick the colour behind it.">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <div className={cn("shrink-0 w-16 h-16 rounded-full", loading && "bg-paper-3 animate-pulse")}>
                  {!loading && <FacehashAvatar name={displayName} color={form.facehashColor} size={64} />}
                </div>
                <ColourPicker
                  value={form.facehashColor}
                  onChange={(colour) => update("facehashColor", colour)}
                  disabled={loading}
                />
              </div>
            </Section>

            <Section title="Details" description="How other readers find and recognise you.">
              <div className="grid gap-5 sm:grid-cols-2">
                <SettingsField id="fullName" label="Name">
                  <input
                    id="fullName"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    disabled={loading}
                    placeholder="Jane Doe"
                    className={FIELD}
                  />
                </SettingsField>
                <SettingsField
                  id="username"
                  label="Username"
                  error={errors.username}
                  hint={
                    <>
                      Letters, numbers and underscores; your bookcase lives at{" "}
                      <span className="text-ink whitespace-nowrap">/u/{form.username.trim() || "username"}</span>
                    </>
                  }
                >
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
                    onBlur={(e) =>
                      e.target.value !== saved?.username &&
                      setErrors((er) => ({ ...er, username: validateField("username", e.target.value.trim(), saved) }))
                    }
                    disabled={loading}
                    placeholder="jane_reads"
                    className={FIELD}
                  />
                </SettingsField>
                <SettingsField id="email" label="Email" hint="Used to sign in. It isn’t shown on your profile.">
                  <input id="email" type="email" value={user?.email || ""} disabled readOnly className={FIELD} />
                </SettingsField>
                <SettingsField id="website" label="Website" error={errors.website} hint="Optional. Your blog, or wherever else you talk about books.">
                  <input
                    id="website"
                    name="website"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    disabled={loading}
                    placeholder="https://example.com"
                    className={FIELD}
                  />
                </SettingsField>
              </div>
            </Section>

            <Section title="Privacy" description="Choose who can see your bookcase.">
              <PrivateToggle
                checked={form.isPrivate}
                onChange={(value) => update("isPrivate", value)}
                disabled={loading}
              />
            </Section>

            <FormMessage>{errors.form}</FormMessage>

            <div
              className={cn(
                "card px-4 py-3 sm:px-5 flex items-center justify-between gap-3",
                // Float the save bar while there's something to save
                dirty && "sticky bottom-4 z-10 shadow-[0_10px_40px_-16px_rgba(0,0,0,0.35)]"
              )}
            >
              <p role="status" className="label text-textSecondary flex items-center gap-1.5 min-w-0">
                {status === "saved" ? (
                  <>
                    <CheckIcon className="text-shelved" /> <span className="text-shelved">Changes saved</span>
                  </>
                ) : dirty ? (
                  "You have unsaved changes"
                ) : loading ? (
                  "Loading your profile…"
                ) : (
                  "No changes to save"
                )}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {dirty && status !== "saving" && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(saved);
                      setErrors({});
                    }}
                    className="btn btn-ghost"
                  >
                    Discard
                  </button>
                )}
                <button type="submit" disabled={!dirty || status === "saving"} className="btn btn-primary">
                  {status === "saving" ? (
                    <>
                      <Spinner /> Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            </div>
          </form>
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="password" className="outline-none">
          <PasswordForm supabase={supabase} email={user?.email} />
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </SettingsFrame>
  );
}

function SettingsFrame({ bookcaseHref, children }) {
  return (
    <div className="UserSettings min-h-[60vh] page-x mx-auto max-w-[1600px] pt-8 sm:pt-12 pb-24">
      <div className="max-w-3xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-ppMondwest text-ink text-[36px] sm:text-[44px] leading-none">Settings</h1>
            <p className="font-ppMondwest text-[17px] text-textSecondary mt-2">Your profile, privacy and password.</p>
          </div>
          {bookcaseHref && (
            <Link href={bookcaseHref} className="btn btn-secondary self-start sm:self-auto">
              View my bookcase
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

function TabTrigger({ value, children }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="label h-11 -mb-px border-b-2 border-transparent text-textSecondary hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink transition-colors focus-ring"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

function Section({ title, description, children }) {
  const id = `settings-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <h2 id={id} className="font-ppMondwest text-ink text-[22px] leading-tight">
        {title}
      </h2>
      {description && <p className="font-ppMondwest text-[15px] leading-snug text-textSecondary mt-1">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// .field plus a visibly disabled state and an error border
const FIELD =
  "field disabled:bg-paper-2 disabled:text-textSecondary disabled:cursor-not-allowed aria-[invalid=true]:border-[#b42318]";

/** Label, control, then either the error or the hint, wired up for screen readers. */
function SettingsField({ id, label, hint, error, children }) {
  const messageId = `${id}-message`;
  const control = cloneElement(children, {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": hint || error ? messageId : undefined
  });
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={id} className="label text-ink">
        {label}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="font-ppMondwest text-[14px] leading-snug text-[#b42318]">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="font-ppMondwest text-[14px] leading-snug text-textSecondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function ColourPicker({ value, onChange, disabled }) {
  const refs = useRef([]);
  const selected = AVATAR_COLOURS.findIndex(([, c]) => c === value);

  // Radio-group keys: arrows move and select, like native radios
  const onKeyDown = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + AVATAR_COLOURS.length) % AVATAR_COLOURS.length;
    onChange(AVATAR_COLOURS[next][1]);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <p id="avatar-colour-label" className="label text-ink">
        Colour
      </p>
      <div role="radiogroup" aria-labelledby="avatar-colour-label" className="grid grid-cols-6 gap-2 w-max sm:flex sm:flex-wrap">
        {AVATAR_COLOURS.map(([name, colour], i) => {
          const checked = i === selected;
          return (
            <button
              key={colour}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={name}
              title={name}
              tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(colour)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "w-10 h-10 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ring-offset-2 transition-shadow disabled:opacity-40",
                checked ? "ring-2 ring-ink" : "hover:ring-2 hover:ring-line"
              )}
              style={{ backgroundColor: colour }}
            >
              {checked && <CheckIcon size={16} className="text-ink" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrivateToggle({ checked, onChange, disabled }) {
  return (
    <label
      htmlFor="private-profile"
      className={cn(
        "min-h-11 rounded-[10px] border border-line px-4 py-3 flex items-center justify-between gap-4 transition-colors",
        disabled ? "bg-paper-2 cursor-not-allowed" : "cursor-pointer hover:bg-paper-2"
      )}
    >
      <span className="min-w-0">
        <span id="private-profile-label" className="block font-ppMondwest text-[17px] leading-tight text-ink">
          Private profile
        </span>
        <span id="private-profile-desc" className="block font-ppMondwest text-[15px] leading-snug text-textSecondary mt-0.5">
          {checked
            ? "Your shelves are hidden. People ask to follow you, and you choose who gets in."
            : "Anyone can see your shelves and follow you."}
        </span>
      </span>
      <button
        id="private-profile"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="private-profile-label"
        aria-describedby="private-profile-desc"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 w-10 h-6 rounded-full border transition-colors",
          checked ? "bg-ink border-ink" : "bg-textSecondary/40 border-transparent"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 left-0.5 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
    </label>
  );
}

function PasswordForm({ supabase, email }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | saving | saved

  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm.length > 0 && confirm === password;
  // Only call out a mismatch once they've typed as much as the first box
  const mismatch = confirm.length > 0 && !matches && confirm.length >= password.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!longEnough) found.password = `Use at least ${MIN_PASSWORD} characters`;
    if (!matches) found.confirm = "Those passwords don’t match";
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(found.password ? "newPassword" : "confirmPassword")?.focus();
      return;
    }

    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("idle");
      setErrors({ form: error.message || "Couldn’t update your password. Please try again." });
      return;
    }
    setPassword("");
    setConfirm("");
    setStatus("saved");
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Section title="Password" description="You’ll stay signed in on this device.">
        <div className="flex flex-col gap-5 max-w-md">
          {/* Lets password managers file the new password under the right account */}
          <input type="email" name="email" autoComplete="username" value={email || ""} readOnly hidden />
          <SettingsField
            id="newPassword"
            label="New password"
            error={errors.password}
            hint={
              <span className={cn("flex items-center gap-1.5", longEnough && "text-shelved")}>
                {longEnough && <CheckIcon />}At least {MIN_PASSWORD} characters
              </span>
            }
          >
            <PasswordField
              id="newPassword"
              value={password}
              onChange={(v) => {
                setPassword(v);
                setStatus("idle");
                setErrors({});
              }}
            />
          </SettingsField>
          <SettingsField
            id="confirmPassword"
            label="Confirm new password"
            error={errors.confirm}
            hint={
              matches ? (
                <span className="flex items-center gap-1.5 text-shelved">
                  <CheckIcon /> Passwords match
                </span>
              ) : mismatch ? (
                <span className="text-[#b42318]">Passwords don’t match yet</span>
              ) : null
            }
          >
            <PasswordField
              id="confirmPassword"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setStatus("idle");
                setErrors({});
              }}
            />
          </SettingsField>
          <FormMessage>{errors.form}</FormMessage>
          <FormMessage tone="success">{status === "saved" && "Password updated. Use it next time you sign in."}</FormMessage>
          <div>
            <button type="submit" disabled={!password || !confirm || status === "saving"} className="btn btn-primary">
              {status === "saving" ? (
                <>
                  <Spinner /> Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </div>
        </div>
      </Section>
    </form>
  );
}

/** Controlled password input with a show/hide toggle that's a full-height tap target. */
function PasswordField({ id, value, onChange, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD, "pr-16")}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={id}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 min-w-14 px-3 rounded-r-[8px] label text-textSecondary hover:text-ink transition-colors"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function CheckIcon({ size = 12, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("shrink-0", className)}>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function validateField(key, value, saved) {
  if (key === "username") {
    const v = value.trim();
    if (!v) return "Choose a username";
    // Leave an existing username alone even if it predates these rules
    if (v === saved?.username) return undefined;
    if (!/^[A-Za-z0-9_]+$/.test(v)) return "Use only letters, numbers and underscores";
    if (v.length < 3) return "Use at least 3 characters";
    if (v.length > 30) return "Keep it to 30 characters or fewer";
  }
  if (key === "website" && value.trim() && value !== saved?.website) {
    try {
      const url = new URL(normaliseWebsite(value));
      if (!url.hostname.includes(".")) throw new Error();
    } catch {
      return "Enter a web address, like example.com";
    }
  }
  return undefined;
}

// "example.com" → "https://example.com"
function normaliseWebsite(value) {
  const v = value.trim();
  if (!v) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function isUniqueViolation(error) {
  return error?.code === "23505" || /duplicate key|unique constraint/i.test(error?.message || "");
}

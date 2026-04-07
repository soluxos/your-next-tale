"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  updateUISettings: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stable client reference — never recreated across renders
  const supabase = useRef(createClient()).current;
  const pathname = usePathname();

  // Track current user id in a ref to avoid stale-closure issues
  const currentUserIdRef = useRef(null);
  const initialisedRef = useRef(false);

  async function loadUser(incomingUser) {
    if (!incomingUser) {
      currentUserIdRef.current = null;
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    currentUserIdRef.current = incomingUser.id;
    setUser(incomingUser);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, username, role, facehash_color, ui_settings")
      .eq("id", incomingUser.id)
      .single();

    setProfile(profileData ?? null);

    setLoading(false);
  }

  async function refreshProfile() {
    if (!currentUserIdRef.current) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, username, role, facehash_color, ui_settings")
      .eq("id", currentUserIdRef.current)
      .single();
    setProfile(profileData ?? null);
  }

  async function updateUISettings(patch) {
    if (!currentUserIdRef.current) return;
    const merged = { ...(profile?.ui_settings ?? {}), ...patch };
    setProfile((prev) => (prev ? { ...prev, ui_settings: merged } : prev));
    await supabase
      .from("profiles")
      .update({ ui_settings: merged })
      .eq("id", currentUserIdRef.current);
  }

  // Mount: initial session + subscribe to client-side auth events
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialisedRef.current = true;
      loadUser(session?.user ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Path change: re-check session to catch server-action sign-ins/sign-outs
  useEffect(() => {
    if (!initialisedRef.current) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const incomingId = session?.user?.id ?? null;
      if (incomingId !== currentUserIdRef.current) {
        loadUser(session?.user ?? null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, updateUISettings }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

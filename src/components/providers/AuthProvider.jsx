"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const AuthContext = createContext({
  user: null,
  profile: null,
  avatarUrl: null,
  loading: true
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
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
      setAvatarUrl(null);
      setLoading(false);
      return;
    }

    currentUserIdRef.current = incomingUser.id;
    setUser(incomingUser);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, username, role")
      .eq("id", incomingUser.id)
      .single();

    setProfile(profileData ?? null);

    // Use a signed URL so the avatar works with private storage buckets
    if (profileData?.avatar_url) {
      const { data: signedData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profileData.avatar_url, 3600);
      setAvatarUrl(signedData?.signedUrl ?? null);
    } else {
      setAvatarUrl(null);
    }

    setLoading(false);
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
    <AuthContext.Provider value={{ user, profile, avatarUrl, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

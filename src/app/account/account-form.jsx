"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Avatar from "./avatar";

export default function AccountForm({ user }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [fullname, setFullname] = useState(null);
  const [username, setUsername] = useState(null);
  const [website, setWebsite] = useState(null);
  const [avatar_url, setAvatarUrl] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [bio, setBio] = useState(null);

  const getProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error, status } = await supabase
        .from("profiles")
        .select(`full_name, username, website, avatar_url, is_private, bio`)
        .eq("id", user?.id)
        .single();
      if (error && status !== 406) throw error;
      if (data) {
        setFullname(data.full_name);
        setUsername(data.username);
        setWebsite(data.website);
        setAvatarUrl(data.avatar_url);
        setIsPrivate(data.is_private ?? false);
        setBio(data.bio);
      }
    } catch (error) {
      alert("Error loading user data!");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    getProfile();
  }, [user, getProfile]);

  async function updateProfile({ username, website, avatar_url }) {
    try {
      setLoading(true);
      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        full_name: fullname,
        username,
        website,
        avatar_url,
        is_private: isPrivate,
        bio,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert("Profile updated!");
    } catch (error) {
      alert("Error updating the data!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="AccountForm min-h-screen bg-white p-6 pt-32 max-w-xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="font-ppMondwest text-[24px] text-textPrimary">Account Settings</h1>
        <p className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
          Update your profile information
        </p>
      </div>

      <Avatar
        uid={user?.id}
        url={avatar_url}
        size={80}
        onUpload={(url) => {
          setAvatarUrl(url);
          updateProfile({ fullname, username, website, avatar_url: url });
        }}
      />

      <div className="w-full h-px bg-border" />

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="font-departureMono uppercase text-[10px] text-textSecondary block">
            Email
          </label>
          <input
            id="email"
            type="text"
            value={user?.email}
            disabled
            className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-[#f4f4f4] opacity-60 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="fullName" className="font-departureMono uppercase text-[10px] text-textSecondary block">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullname || ""}
            onChange={(e) => setFullname(e.target.value)}
            className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="username" className="font-departureMono uppercase text-[10px] text-textSecondary block">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username || ""}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="website" className="font-departureMono uppercase text-[10px] text-textSecondary block">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={website || ""}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full border border-border rounded-[8px] px-3 h-9 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="bio" className="font-departureMono uppercase text-[10px] text-textSecondary block">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio || ""}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell us about yourself..."
            className="w-full border border-border rounded-[8px] px-3 py-2 font-departureMono text-[12px] text-textPrimary bg-transparent focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary resize-none"
          />
        </div>

        <div className="flex items-center gap-3 py-1">
          <input
            id="isPrivate"
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-4 h-4 rounded accent-textPrimary"
          />
          <label htmlFor="isPrivate" className="font-departureMono uppercase text-[10px] text-textSecondary">
            {isPrivate ? "🔒 " : ""}Private profile
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => updateProfile({ fullname, username, website, avatar_url })}
          disabled={loading}
          className="h-[44px] px-6 bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors disabled:opacity-40"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="h-[44px] px-4 bg-white text-textPrimary border border-border hover:bg-[#f4f4f4] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}


  const getProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error, status } = await supabase
        .from("profiles")
        .select(`full_name, username, website, avatar_url, is_private, bio`)
        .eq("id", user?.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setFullname(data.full_name);
        setUsername(data.username);
        setWebsite(data.website);
        setAvatarUrl(data.avatar_url);
        setIsPrivate(data.is_private ?? false);
        setBio(data.bio);
      }
    } catch (error) {
      alert("Error loading user data!");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    getProfile();
  }, [user, getProfile]);

  async function updateProfile({ username, website, avatar_url }) {
    try {
      setLoading(true);

      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        full_name: fullname,
        username,
        website,
        avatar_url,
        is_private: isPrivate,
        bio,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert("Profile updated!");
    } catch (error) {
      alert("Error updating the data!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-widget">
      <Avatar
        uid={user?.id}
        url={avatar_url}
        size={150}
        onUpload={(url) => {
          setAvatarUrl(url);
          updateProfile({ fullname, username, website, avatar_url: url });
        }}
      />
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="text" value={user?.email} disabled />
      </div>
      <div>
        <label htmlFor="fullName">Full Name</label>
        <input
          id="fullName"
          type="text"
          value={fullname || ""}
          onChange={(e) => setFullname(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username || ""}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="url"
          value={website || ""}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          value={bio || ""}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Tell us about yourself..."
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          id="isPrivate"
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          style={{ width: "auto" }}
        />
        <label htmlFor="isPrivate" style={{ display: "inline" }}>
          {isPrivate ? "🔒 " : ""}Private profile
        </label>
      </div>

      <div>
        <button
          className="button primary block"
          onClick={() =>
            updateProfile({ fullname, username, website, avatar_url })
          }
          disabled={loading}
        >
          {loading ? "Loading ..." : "Update"}
        </button>
      </div>

      <div>
        <form action="/auth/signout" method="post">
          <button className="button block" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

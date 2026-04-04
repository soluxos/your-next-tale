"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, User, Mail, Globe, Lock, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FacehashAvatar from "@/components/profile/FacehashAvatar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export default function UserSettings({ user: serverUser }) {
  // Stable supabase client — never recreate across renders so useCallback works
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const { user: clientUser, loading: authLoading, refreshProfile } = useAuth();

  // Prefer the live client-side user (handles first-time email confirmation
  // where the server prop may be stale before the cookie is hydrated)
  const user = clientUser ?? serverUser;
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [facehashColor, setFacehashColor] = useState(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification states
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    newBooks: true,
    recommendations: false,
    newsletter: true
  });

  const getProfile = useCallback(async () => {
    // Guard: user must be a real UUID string, not undefined/null/"undefined"
    if (!user?.id || typeof user.id !== "string" || user.id === "undefined")
      return;
    try {
      setLoading(true);

      const { data, error, status } = await supabase
        .from("profiles")
        .select(
          `full_name, username, website, avatar_url, is_private, facehash_color`
        )
        .eq("id", user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setWebsite(data.website || "");
        setIsPrivate(data.is_private ?? false);
        setFacehashColor(data.facehash_color || null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!authLoading) getProfile();
  }, [user, authLoading, getProfile]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        username,
        website,
        is_private: isPrivate,
        facehash_color: facehashColor,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      await refreshProfile();
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      alert("Error updating profile!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      alert("Error updating password!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationChange = (key, value) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-departureMono uppercase text-[10px] text-textSecondary">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 pt-20 max-w-3xl mx-auto">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-ppMondwest text-[24px] text-textPrimary">
            Account Settings
          </h1>
          <p className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
            Manage your account information and preferences.
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="font-ppMondwest text-[18px] text-textPrimary">
                  Profile Information
                </CardTitle>
                <CardDescription className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
                  Update your personal details here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile Avatar */}
                <div className="font-departureMono uppercase text-[10px] text-textSecondary flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span>Profile Avatar</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FacehashAvatar
                      name={fullName || username}
                      color={facehashColor}
                      size={48}
                    />
                    <p className="font-departureMono text-[10px] text-textSecondary">
                      Generated from your name
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                      Avatar Colour
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {[
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
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFacehashColor(color)}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            facehashColor === color
                              ? "border-textPrimary scale-110"
                              : "border-transparent hover:border-border"
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select colour ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="fullName"
                      className="font-departureMono uppercase text-[10px] text-textSecondary flex items-center gap-2"
                    >
                      <User className="h-3 w-3" />
                      Full Name
                    </label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="username"
                      className="font-departureMono uppercase text-[10px] text-textSecondary"
                    >
                      Username
                    </label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="font-departureMono uppercase text-[10px] text-muted-foreground flex items-center gap-2"
                  >
                    <Mail className="h-3 w-3" />
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="website"
                    className="font-departureMono uppercase text-[10px] text-muted-foreground flex items-center gap-2"
                  >
                    <Globe className="h-3 w-3" />
                    Website
                  </label>
                  <Input
                    id="website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-textSecondary" />
                      <span className="font-departureMono uppercase text-[10px] text-textSecondary">
                        Private Profile
                      </span>
                    </div>
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      {isPrivate
                        ? "🔒 Your shelves are hidden from other users"
                        : "Your shelves are visible to everyone"}
                    </p>
                  </div>
                  <Switch
                    checked={isPrivate}
                    onCheckedChange={(checked) => setIsPrivate(checked)}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <p className="font-departureMono text-[11px] text-textSecondary">
                    {user?.email}
                  </p>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="h-[36px] px-4 flex items-center gap-2 bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors disabled:opacity-40"
                  >
                    {showSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Saved
                      </>
                    ) : isSaving ? (
                      "Saving..."
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-ppMondwest text-[18px] text-textPrimary">
                  Change Password
                </CardTitle>
                <CardDescription className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="currentPassword"
                    className="font-departureMono uppercase text-[10px] text-textSecondary flex items-center gap-2"
                  >
                    <Lock className="h-3 w-3" />
                    Current Password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <label
                    htmlFor="newPassword"
                    className="font-departureMono uppercase text-[10px] text-textSecondary"
                  >
                    New Password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="font-departureMono uppercase text-[10px] text-textSecondary"
                  >
                    Confirm New Password
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleUpdatePassword}
                    disabled={
                      isSaving ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="h-[36px] px-4 flex items-center gap-2 bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors disabled:opacity-40"
                  >
                    {showSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Updated
                      </>
                    ) : isSaving ? (
                      "Updating..."
                    ) : (
                      "Update Password"
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-ppMondwest text-[18px] text-textPrimary">
                  Email Notifications
                </CardTitle>
                <CardDescription className="font-departureMono uppercase text-[10px] text-textSecondary mt-1">
                  Choose what updates you want to receive via email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-3 w-3 text-textSecondary" />
                      <span className="font-departureMono uppercase text-[11px] text-textPrimary">
                        Account Updates
                      </span>
                    </div>
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      Important notifications about your account activity.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailUpdates}
                    onCheckedChange={(checked) =>
                      handleNotificationChange("emailUpdates", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-departureMono uppercase text-[11px] text-textPrimary">
                      New Book Releases
                    </span>
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      Get notified when new books are added to the library.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.newBooks}
                    onCheckedChange={(checked) =>
                      handleNotificationChange("newBooks", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-departureMono uppercase text-[11px] text-textPrimary">
                      Personalized Recommendations
                    </span>
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      Book recommendations based on your reading history.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.recommendations}
                    onCheckedChange={(checked) =>
                      handleNotificationChange("recommendations", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-departureMono uppercase text-[11px] text-textPrimary">
                      Newsletter
                    </span>
                    <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                      Weekly digest of trending books and reading tips.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.newsletter}
                    onCheckedChange={(checked) =>
                      handleNotificationChange("newsletter", checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, User, Mail, Globe, Lock, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
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

export default function UserSettings({ user }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarPath, setAvatarPath] = useState(null); // storage path
  const [avatarUrl, setAvatarUrl] = useState(null); // displayable URL
  const [isPrivate, setIsPrivate] = useState(false);

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
    try {
      setLoading(true);

      const { data, error, status } = await supabase
        .from("profiles")
        .select(`full_name, username, website, avatar_url, is_private`)
        .eq("id", user?.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setFullName(data.full_name || "");
        setUsername(data.username || "");
        setWebsite(data.website || "");
        setAvatarPath(data.avatar_url);
        setIsPrivate(data.is_private ?? false);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    getProfile();
  }, [user, getProfile]);

  // Download avatar from Supabase storage when avatarPath changes
  useEffect(() => {
    async function downloadAvatar(path) {
      try {
        const { data, error } = await supabase.storage
          .from("avatars")
          .download(path);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        setAvatarUrl(url);
      } catch (error) {
        console.error("Error downloading avatar:", error);
      }
    }

    if (avatarPath) {
      downloadAvatar(avatarPath);
    }
  }, [avatarPath, supabase]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        full_name: fullName,
        username,
        website,
        avatar_url: avatarPath,
        is_private: isPrivate,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
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

  const uploadAvatar = async (event) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update avatar path (triggers re-download via useEffect)
      setAvatarPath(filePath);

      // Save the new avatar path to the profile
      const { error: updateError } = await supabase.from("profiles").upsert({
        id: user?.id,
        avatar_url: filePath,
        updated_at: new Date().toISOString()
      });
      if (updateError) throw updateError;
    } catch (error) {
      alert("Error uploading avatar!");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 pt-40 max-w-3xl mx-auto">
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
                {/* Profile Photo */}
                <div className="font-departureMono uppercase text-[10px] text-textSecondary flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3 w-3" />
                    <span>Profile Photo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={avatarUrl} alt={fullName} />
                      <AvatarFallback className="font-departureMono text-[11px] bg-[#f4f4f4] text-textPrimary">
                        {getInitials(fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-[36px] px-3 font-departureMono uppercase text-[10px] text-textPrimary border border-border rounded-[8px] hover:bg-[#f4f4f4] transition-colors disabled:opacity-40"
                    >
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={uploadAvatar}
                    />
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

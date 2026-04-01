"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function login(formData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email"),
    password: formData.get("password")
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

export async function signup(formData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("full_name") || "";

  // Build the confirmation redirect URL dynamically so it works in all environments
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || "http";
  const emailRedirectTo = `${proto}://${host}/auth/confirm`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { full_name: fullName }
    }
  });

  if (error) {
    return { error: error.message };
  }

  // Supabase returns a fake success with no identities when the email is
  // already registered (prevents email enumeration on their end)
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      error:
        "An account with this email already exists. Please sign in instead."
    };
  }

  // Create the profile row now only if email confirmation is disabled (session exists).
  // When confirmation is required the profile is created after the user confirms
  // via /auth/confirm — do not create it here with an unconfirmed user.
  if (data.session && data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      updated_at: new Date().toISOString()
    });
  }

  // No session means email confirmation is required
  if (!data.session) {
    redirect("/get-started?message=check-email");
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

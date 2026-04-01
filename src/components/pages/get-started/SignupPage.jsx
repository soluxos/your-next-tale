"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signup } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function SignupPage() {
  const searchParams = useSearchParams();
  const emailConfirmation = searchParams.get("message") === "check-email";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    const formData = new FormData(e.target);
    try {
      const result = await signup(formData);
      if (result?.error) {
        setErrorMessage(result.error);
      }
    } catch (err) {
      if (
        err?.message === "NEXT_REDIRECT" ||
        err?.digest?.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <div className="mb-8 text-center">
        <p className="font-ppMondwest text-[#0c0c0c] text-[24px] leading-none mb-2">
          Your next tale
        </p>
        <p className="font-departureMono uppercase text-textSecondary text-[11px]">
          Curated fantasy & sci-fi books
        </p>
      </div>

      <Card className="w-full max-w-[380px] shadow-sm border-border">
        {emailConfirmation ? (
          <>
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl font-ppMondwest text-textPrimary">
                Check your email
              </CardTitle>
              <CardDescription className="font-departureMono uppercase text-[11px] text-textSecondary mt-2">
                Account created successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <p className="font-departureMono uppercase text-[11px] text-textSecondary leading-relaxed">
                We&apos;ve sent a confirmation link to your email address.
                Please click it to activate your account before signing in.
              </p>
              <Link href="/login">
                <Button className="w-full h-[44px] bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors mt-2">
                  Go to sign in
                </Button>
              </Link>{" "}
            </CardContent>{" "}
          </>
        ) : (
          <>
            <CardHeader className="p-6 pb-0">
              <CardTitle className="text-xl font-ppMondwest text-textPrimary">
                Create an account
              </CardTitle>
              <CardDescription className="font-departureMono uppercase text-[11px] text-textSecondary mt-2">
                Enter your details to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="full_name"
                    className="font-departureMono uppercase text-[10px] text-textSecondary"
                  >
                    Full name
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-9 bg-transparent border-border rounded-[8px] font-departureMono text-[12px] focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-departureMono uppercase text-[10px] text-textSecondary"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 bg-transparent border-border rounded-[8px] font-departureMono text-[12px] focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="font-departureMono uppercase text-[10px] text-textSecondary"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 bg-transparent border-border rounded-[8px] font-departureMono text-[12px] focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <p className="font-departureMono uppercase text-[10px] text-textSecondary">
                    Minimum 8 characters
                  </p>
                </div>

                {errorMessage && (
                  <p className="font-departureMono uppercase text-[10px] text-red-500">
                    {errorMessage}{" "}
                    {errorMessage.toLowerCase().includes("already exists") && (
                      <Link
                        href="/login"
                        className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                      >
                        Sign in
                      </Link>
                    )}
                  </p>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-10"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create account"}
                  </Button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <p className="font-departureMono uppercase text-[11px] text-textSecondary">
                  Already have an account?
                  <Link
                    href="/login"
                    className="text-textPrimary underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Footer */}
      <p className="mt-6 font-departureMono uppercase text-[10px] text-textSecondary">
        Discover new fantasy and sci-fi novels
      </p>
    </div>
  );
}

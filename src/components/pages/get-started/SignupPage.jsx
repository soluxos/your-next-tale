"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
        <p
          className="text-[#0c0c0c] text-[24px] leading-none mb-2"
          style={{ fontFamily: "ppmondwest, serif" }}
        >
          Your next tale
        </p>
        <p className="font-departureMono uppercase text-textSecondary text-[11px]">
          Curated fantasy & sci-fi books
        </p>
      </div>

      <Card className="w-full max-w-[380px] shadow-sm border-gray-200">
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
              <a href="/login">
                <Button className="w-full h-10 mt-2">Go to sign in</Button>
              </a>
            </CardContent>
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
                    className="font-departureMono uppercase text-[11px] text-textPrimary"
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
                    className="h-10 bg-white border-gray-200 focus:border-gray-400"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="font-departureMono uppercase text-[11px] text-textPrimary"
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
                    className="h-10 bg-white border-gray-200 focus:border-gray-400"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="font-departureMono uppercase text-[11px] text-textPrimary"
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
                    className="h-10 bg-white border-gray-200 focus:border-gray-400"
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
                    {errorMessage}
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
                  <a
                    href="/login"
                    className="text-textPrimary underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    Sign in
                  </a>
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

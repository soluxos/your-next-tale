"use client";

import { useState } from "react";
import { login } from "@/app/login/actions";
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

export default function LoginPage({ message }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    message === "check-email"
      ? "Account created! Check your email to confirm your address before signing in."
      : ""
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    const formData = new FormData(e.target);
    try {
      const result = await login(formData);
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
        <CardHeader className="p-6 pb-0">
          <CardTitle className="text-xl font-ppMondwest text-textPrimary">
            Welcome back
          </CardTitle>
          <CardDescription className="font-departureMono uppercase text-[11px] text-textSecondary mt-2">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="font-departureMono uppercase text-[11px] text-textPrimary"
                >
                  Password
                </Label>
                <a
                  href="#"
                  className="font-departureMono uppercase text-[10px] text-textSecondary hover:text-textPrimary transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-white border-gray-200 focus:border-gray-400"
                required
                autoComplete="current-password"
              />
            </div>

            {errorMessage && (
              <p className="font-departureMono uppercase text-[10px] text-red-500">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p className="font-departureMono uppercase text-[10px] text-green-600">
                {successMessage}
              </p>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-10"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <p className="font-departureMono uppercase text-[11px] text-textSecondary">
              Don&apos;t have an account?{" "}
              <a
                href="/get-started"
                className="text-textPrimary underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                Get started
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 font-departureMono uppercase text-[10px] text-textSecondary">
        Discover new fantasy and sci-fi novels
      </p>
    </div>
  );
}

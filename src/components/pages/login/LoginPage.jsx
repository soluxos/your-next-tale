"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

const RAMSAY_LINES = [
  "Sign in. NOW.",
  "That reading list is RAW.",
  "Get in there.",
  "Don't just stand there.",
  "Finally, some taste."
];

export default function LoginPage({ message }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ramsayLine, setRamsayLine] = useState("");

  useEffect(() => {
    setRamsayLine(
      RAMSAY_LINES[Math.floor(Math.random() * RAMSAY_LINES.length)]
    );
  }, []);
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
    <div className="LoginPage min-h-[75vh] bg-white flex flex-col items-center justify-start px-4 py-12">
      {/* Brand */}
      <div className="mb-8 text-center flex flex-col items-center gap-2 pt-10">
        <img src="/new-logo.svg" alt="logo" className="w-auto h-5" />
        <div className="flex flex-col items-center gap-0">
          <p className="font-ppMondwest text-[#0c0c0c] text-[20px] leading-none mb-2">
            Your next tale
          </p>
          <p className="font-departureMono uppercase text-[10px] text-textSecondary">
            Build your bookshelf. Discover your next read.
          </p>
        </div>
      </div>
      <Card className="w-full max-w-[380px] shadow-sm border-border">
        <CardHeader className="p-6 pb-0">
          <CardTitle className="text-xl font-ppMondwest">
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
                className="h-9 bg-transparent border-border rounded-[8px] font-departureMono text-[12px] focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="font-departureMono uppercase text-[10px] text-textSecondary"
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
                className="h-9 bg-transparent border-border rounded-[8px] font-departureMono text-[12px] focus:outline-none focus:ring-1 focus:ring-textPrimary placeholder:text-textSecondary"
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
                className="w-full h-[44px] bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <p className="font-departureMono uppercase text-[11px] text-textSecondary">
              Don&apos;t have an account?{" "}
              <Link
                href="/get-started"
                className="text-textPrimary underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                Get started
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 font-departureMono uppercase text-[10px] text-textSecondary">
        {ramsayLine}
      </p>
    </div>
  );
}

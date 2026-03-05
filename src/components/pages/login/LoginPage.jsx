"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function LoginPage({ login, signup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    try {
      if (isSignup) {
        await signup(formData);
      } else {
        await login(formData);
      }
    } catch (error) {
      // redirect throws in Next.js, so this may not execute
      console.error(error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f9f9fb] flex flex-col items-center justify-center px-4 py-12">
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
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
                className="border-gray-300 data-[state=checked]:bg-[#1f1f1f] data-[state=checked]:border-[#1f1f1f]"
              />
              <Label
                htmlFor="remember"
                className="font-departureMono uppercase text-[10px] text-textSecondary cursor-pointer"
              >
                Remember me
              </Label>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full h-10"
                disabled={isLoading}
                onClick={() => setIsSignup(false)}
              >
                {isLoading && !isSignup ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="submit"
                variant="outline"
                className="w-full h-10"
                disabled={isLoading}
                onClick={() => setIsSignup(true)}
              >
                {isLoading && isSignup ? "Signing up..." : "Sign up"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center px-6 pb-6 pt-0">
          <p className="font-departureMono uppercase text-[11px] text-textSecondary">
            Use the buttons above to sign in or create an account
          </p>
        </CardFooter>
      </Card>

      {/* Footer */}
      <p className="mt-6 font-departureMono uppercase text-[10px] text-textSecondary">
        Discover new fantasy and sci-fi novels
      </p>
    </div>
  );
}

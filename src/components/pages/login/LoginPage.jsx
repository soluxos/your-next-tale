"use client";

import { useState } from "react";
import { login } from "@/app/login/actions";
import AuthShell, { AuthLink, Field, FormMessage } from "@/components/pages/auth/AuthShell";
import PasswordInput from "@/components/pages/auth/PasswordInput";
import { Spinner } from "@/components/ui/spinner";

const isRedirect = (err) =>
  err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT");

export default function LoginPage({ message, next, showcase }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const notice =
    message === "check-email"
      ? "Account created — check your email and click the link to confirm it, then sign in here."
      : message === "reset-sent"
        ? "If that email has an account, a reset link is on its way."
        : "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await login(new FormData(e.currentTarget));
      if (result?.error) setErrorMessage(friendly(result.error));
    } catch (err) {
      if (isRedirect(err)) throw err;
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle={next ? "Sign in to save books to your shelves." : "Sign in to your bookcase."}
      showcase={showcase}
      footer={
        <p className="font-ppMondwest text-[16px] text-textSecondary">
          New here? <AuthLink href="/get-started">Create a free account</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
        <FormMessage tone="success">{notice}</FormMessage>
        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="field w-full"
          />
        </Field>
        <Field
          id="password"
          label="Password"
          action={
            <AuthLink href="/login/forgot">
              <span className="label">Forgot password?</span>
            </AuthLink>
          }
        >
          <PasswordInput id="password" autoComplete="current-password" />
        </Field>
        <FormMessage>{errorMessage}</FormMessage>
        <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Spinner /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

function friendly(error) {
  if (/invalid login credentials/i.test(error)) return "That email and password don’t match. Check them and try again.";
  if (/email not confirmed/i.test(error)) return "Please confirm your email first — check your inbox for the link we sent.";
  return error;
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signup } from "@/app/login/actions";
import AuthShell, { AuthLink, Field, FormMessage } from "@/components/pages/auth/AuthShell";
import PasswordInput from "@/components/pages/auth/PasswordInput";
import { Spinner } from "@/components/ui/spinner";

const isRedirect = (err) =>
  err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT");

export default function SignupPage({ showcase }) {
  const searchParams = useSearchParams();
  const emailConfirmation = searchParams.get("message") === "check-email";
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await signup(new FormData(e.currentTarget));
      if (result?.error) setErrorMessage(result.error);
    } catch (err) {
      if (isRedirect(err)) throw err;
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailConfirmation) {
    return (
      <AuthShell title="Check your email" showcase={showcase}>
        <div className="flex flex-col gap-5">
          <p className="font-ppMondwest text-[17px] leading-snug text-textPrimary">
            We&rsquo;ve sent a confirmation link to your inbox. Click it to activate your account —
            you&rsquo;ll land on your new bookcase.
          </p>
          <p className="font-ppMondwest text-[15px] leading-snug text-textSecondary">
            Nothing after a few minutes? Check your spam folder.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg w-full">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const exists = errorMessage.toLowerCase().includes("already exists");

  return (
    <AuthShell
      title="Start your bookcase"
      subtitle="Free, takes a minute. You’ll get four shelves ready to fill."
      showcase={showcase}
      footer={
        <p className="font-ppMondwest text-[16px] text-textSecondary">
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field id="full_name" label="Your name">
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Doe"
            className="field w-full"
          />
        </Field>
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
        <Field id="password" label="Password" hint="At least 8 characters">
          <PasswordInput id="password" autoComplete="new-password" minLength={8} describedBy="password-hint" />
        </Field>
        <FormMessage>
          {errorMessage}
          {exists && (
            <>
              {" "}
              <AuthLink href="/login">Sign in instead</AuthLink>
            </>
          )}
        </FormMessage>
        <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Spinner /> Creating your bookcase…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

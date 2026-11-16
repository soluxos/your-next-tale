"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/app/login/actions";
import AuthShell, { AuthLink, Field, FormMessage } from "@/components/pages/auth/AuthShell";
import { Spinner } from "@/components/ui/spinner";

export default function ForgotPasswordPage({ showcase }) {
  const [state, setState] = useState({ loading: false, sent: false, error: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    setState({ loading: true, sent: false, error: "" });
    try {
      const result = await requestPasswordReset(new FormData(e.currentTarget));
      setState({ loading: false, sent: !result?.error, error: result?.error || "" });
    } catch {
      setState({ loading: false, sent: false, error: "Something went wrong. Please try again." });
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a link that signs you in, so you can choose a new password from your account settings."
      showcase={showcase}
      footer={
        <p className="font-ppMondwest text-[16px] text-textSecondary">
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      {state.sent ? (
        <FormMessage tone="success">
          If that email has an account, a reset link is on its way. It can take a minute or two —
          check your spam folder too.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
          <FormMessage>{state.error}</FormMessage>
          <button type="submit" disabled={state.loading} className="btn btn-primary btn-lg w-full">
            {state.loading ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              "Email me a reset link"
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

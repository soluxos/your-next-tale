"use client";

import { useEffect } from "react";
import StatusPage from "@/components/status/StatusPage";
import { HomeAction } from "@/components/status/StatusActions";

export default function RouteError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      eyebrow="Error · Something went wrong"
      title="This page fell off the shelf"
      actions={
        <>
          <button type="button" onClick={() => reset()} className="btn btn-primary">
            Try again
          </button>
          <HomeAction />
        </>
      }
    >
      <p>We hit an unexpected error loading this page. Your books are safe — try again, or head back.</p>
      {/* Lets a reader quote something useful if they get in touch */}
      {error?.digest && <p className="label mt-3">Reference {error.digest}</p>}
    </StatusPage>
  );
}

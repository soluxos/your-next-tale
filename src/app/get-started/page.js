import { Suspense } from "react";
import SignupPage from "@/components/pages/get-started/SignupPage";

export default function GetStarted() {
  return (
    <Suspense>
      <SignupPage />
    </Suspense>
  );
}

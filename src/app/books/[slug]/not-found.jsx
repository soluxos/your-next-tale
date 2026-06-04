import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="NotFound min-h-screen flex items-center justify-center bg-gradient-to-b from-bookLightDark to-bookLightLight">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-4xl font-ppMondwest text-textPrimary mb-2">
          Book Not Found
        </h1>
        <p className="text-lg font-ppMondwest text-textSecondary mb-4">
          Sorry, we couldn't find the book you're looking for.
        </p>
        <Button asChild variant="default">
          <Link href="/">Return to Library</Link>
        </Button>
      </div>
    </div>
  );
}

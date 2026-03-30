export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-2">
        Error
      </p>
      <h1 className="font-ppMondwest text-[32px] text-textPrimary mb-4">
        Something went wrong
      </h1>
      <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-8">
        An unexpected error occurred. Please try again.
      </p>
      <a
        href="/"
        className="h-[44px] px-6 flex items-center bg-[#1f1f1f] text-white hover:bg-[#353535] font-departureMono uppercase text-[11px] rounded-[8px] transition-colors"
      >
        Back to Home
      </a>
    </div>
  );
}

export default function Hero() {
  return (
    <div className="relative w-full h-[510px] overflow-hidden bg-[#f9f9fb] flex items-center justify-center pt-10">
      {/* Centred headline + subtitle */}
      <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-[#565656] text-[36px] leading-[1.25] max-w-[600px] font-ppMondwest">
          Discover new fantasy and sci-fi novels
        </p>
        <p className="text-[#bcbcc2] text-[16px] leading-[1.5] max-w-[460px] font-satoshi">
          Hand curated sci-fi and fantasy books to help you find your next great
          read. Updated weekly.
        </p>
      </div>
    </div>
  );
}

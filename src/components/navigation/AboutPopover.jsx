export default function AboutPopover() {
  return (
    <div className="absolute bottom-full mb-2 bg-transparent p-4 w-auto flex gap-4">
      {/* Card 1 */}
      <div className="bg-white border border-gray-300 rounded-[8px] shadow-lg p-4 w-64">
        <p className="font-departureMono uppercase text-[12px] text-black">What is this place?</p>
        <p className="font-departureMono text-[10px] text-textSecondary">
          It’s kinda like the fantasy and sci-fi shelf in a store.
        </p>
      </div>

      {/* Card 2 */}
      <div className="bg-black border border-gray-300 rounded-[8px] shadow-lg p-4 w-64">
        <p className="font-departureMono uppercase text-[12px] text-white">What’s so special?</p>
        <p className="font-departureMono text-[10px] text-textSecondary">
          More features will come to the site. I’m only a one-man band for now.
        </p>
      </div>

      {/* Card 3 */}
      <div className="bg-yellow-400 border border-gray-300 rounded-[8px] shadow-lg p-4 w-64">
        <p className="font-departureMono uppercase text-[12px] text-black">Who made it?</p>
        <p className="font-departureMono text-[10px] text-textSecondary">
          Oh yeah, I’m Callum. I’m just a guy based in the UK.
        </p>
      </div>
    </div>
  )
}

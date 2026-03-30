import { AnimatePresence, motion } from "framer-motion"; // Import AnimatePresence and motion from framer-motion
import PropTypes from "prop-types"; // Import PropTypes for type checking

export default function AboutPopover({ isPopoverVisible, handleMouseLeave }) {
  return (
    <AnimatePresence>
      {isPopoverVisible && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0 bg-transparent p-4 pb-8 w-auto flex gap-6 z-50"
          onMouseLeave={handleMouseLeave}
        >
          {/* Card 1 */}
          <motion.div
            key="card1"
            initial={{ opacity: 0, y: 40, rotate: -10 }}
            animate={{ opacity: 1, y: -20, rotate: -4 }}
            exit={{ opacity: 0, y: 40, rotate: -10 }}
            transition={{
              opacity: { duration: 0.3, delay: 0.1 },
              y: { type: "spring", stiffness: 500, damping: 15, delay: 0.1 },
              rotate: {
                type: "spring",
                stiffness: 500,
                damping: 15,
                delay: 0.1
              }
            }}
            className="bg-white border border-border rounded-[8px] shadow-lg p-4 w-[240px] h-auto"
          >
            <div className="flex flex-col gap-2">
              <p className="font-departureMono uppercase text-[12px] text-textPrimary">
                What is this place?
              </p>
              <p className="font-departureMono text-[10px] text-textSecondary">
                It’s kinda like the fantasy and sci-fi shelf in a store.
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2 mt-2">
                <li className="font-departureMono uppercase text-[11px] text-[#FF3131] decoration-double">
                  <span className="text-textSecondary">
                    Discover curated fantasy books
                  </span>
                </li>
                <li className="font-departureMono uppercase text-[11px] text-[#2CA7FF] decoration-double">
                  <span className="text-textSecondary">
                    Only shows the first book in a series
                  </span>
                </li>
                <li className="font-departureMono uppercase text-[11px] text-[#2BD26B] decoration-double">
                  <span className="text-textSecondary">
                    Get a bookshop experience all from a browser
                  </span>
                </li>
                <li className="font-departureMono uppercase text-[11px] text-[#FFD700] decoration-double">
                  <span className="text-textSecondary">
                    New books regularly added
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
          {/* Card 2 */}
          <motion.div
            key="card2"
            initial={{ opacity: 0, y: 20, rotate: 5 }}
            animate={{ opacity: 1, y: -60, rotate: 2 }}
            exit={{ opacity: 0, y: -20, rotate: 5 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { type: "spring", stiffness: 500, damping: 15 },
              rotate: { type: "spring", stiffness: 500, damping: 15 },
              delay: 0.4
            }}
            className="bg-black rounded-[8px] shadow-lg p-4 w-[240px] h-[320px] gap-6 justify-end flex flex-col"
          >
            <div className="w-6">
              <svg
                id="pencil"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="#FFFFFF"
              >
                <path d="m22,4v-1h-1v-1h-1v-1h-4v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v7h7v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-4h-1Zm-14,16h-1v1h-3v-1h-1v-3h1v-1h1v1h1v1h1v1h1v1Zm9-9h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h2v1h1v1h1v2Zm1-3v-1h-1v-1h-1v-2h1v-1h2v1h1v1h1v2h-1v1h-2Z" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-departureMono uppercase text-[12px] text-white">
                What’s so special?
              </p>
              <p className="font-departureMono text-[10px] text-textSecondary">
                I guess it’s the fact that I’m not making this as a business. I
                just wanted a cool site to find new fantasy and sci-fi books.
                <br />
                <br />I also love to obsess over the minute interactions.
              </p>
            </div>
          </motion.div>
          {/* Card 3 */}
          <motion.div
            key="card3"
            initial={{ opacity: 0, y: 20, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: 5 }}
            exit={{ opacity: 0, y: 20, rotate: 0 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { type: "spring", stiffness: 500, damping: 15 },
              rotate: { type: "spring", stiffness: 500, damping: 15 },
              delay: 0.2
            }}
            className="bg-[#FFC131] rounded-[8px] shadow-lg p-4 w-[240px] h-[320px] self-auto"
          >
            <div className="flex flex-col justify-between h-full gap-4">
              <p className="font-departureMono uppercase text-[12px] text-textPrimary">
                Who made it?
              </p>
              <img
                src="/images/me.png"
                alt="just a little pixelart rendering of me..."
                className="h-full"
              />
              <p className="font-departureMono text-[10px] text-[rgba(0,0,0,0.4)] mt-auto">
                Oh yeah, I’m Callum. I’m just a guy based in the UK.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// PropTypes for type checking
AboutPopover.propTypes = {
  isPopoverVisible: PropTypes.bool.isRequired,
  handleMouseLeave: PropTypes.func.isRequired
};

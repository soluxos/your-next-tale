"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"

export default function Navigation({ isLoggedIn = false }) {
  const [isPopoverVisible, setIsPopoverVisible] = useState(false)

  const handleMouseEnter = () => {
    setIsPopoverVisible(true)
  }

  const handleMouseLeave = () => {
    setIsPopoverVisible(false)
  }

  return (
    <>
      <div className="nav-block fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-[10px] max-w-[calc(100vw - 48px)]">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            bounce: 0.5,
            duration: 0.8
          }}
          className="bg-white h-12 px-5 border-solid border-gray-300 border-[1px] rounded-[8px] flex items-center gap-4 w-auto relative max-w-[calc(100vw - 48px)]"
        >
          <a href="/" className="flex flex-col items-start">
            <p className="font-departureMono uppercase text-[12px]">Your Next Tale</p>
            <p className="font-departureMono uppercase text-textSecondary text-[10px] whitespace-nowrap">
              Curated fantasy & sci-fi books
            </p>
          </a>
          <nav className="flex items-center">
            {/* <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
          <a href="/" className="flex flex-col items-start px-4 py-[10px]">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">Head</p>
            <p className="font-departureMono uppercase text-[12px] flex gap-1">
              <span className="text-[#2CA7FF]">♦</span> Home
            </p>
          </a> */}
            <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
            <div
              className="about flex flex-col items-start relative cursor-pointer px-4 py-[10px]"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <p className="font-departureMono uppercase text-[10px] text-textSecondary">All</p>
              <p className="font-departureMono uppercase text-[12px] flex gap-1">
                <span className="text-[#FFC131]">✦</span> About
              </p>
            </div>
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
                      rotate: { type: "spring", stiffness: 500, damping: 15, delay: 0.1 }
                    }}
                    className="bg-white border border-gray-300 rounded-[8px] shadow-lg p-4 w-[240px] h-auto"
                  >
                    <div className="flex flex-col gap-2">
                      <p className="font-departureMono uppercase text-[12px] text-black">What is this place?</p>
                      <p className="font-departureMono text-[10px] text-textSecondary">
                        It’s kinda like the fantasy and sci-fi shelf in a store.
                      </p>
                      <ul className="list-disc pl-5 flex flex-col gap-2 mt-2">
                        <li className="font-departureMono uppercase text-[11px] text-[#FF3131] decoration-double underline">
                          <span className="text-textSecondary">Discover curated fantasy books</span>
                        </li>
                        <li className="font-departureMono uppercase text-[11px] text-[#2CA7FF] decoration-double underline">
                          <span className="text-textSecondary">Explore sci-fi recommendations</span>
                        </li>
                        <li className="font-departureMono uppercase text-[11px] text-[#2BD26B] decoration-double underline">
                          <span className="text-textSecondary">Enjoy smooth interactions</span>
                        </li>
                        <li className="font-departureMono uppercase text-[11px] text-[#FFD700] decoration-double underline">
                          <span className="text-textSecondary">Find hidden gems</span>
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
                      <svg id="pencil" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF">
                        <path d="m22,4v-1h-1v-1h-1v-1h-4v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v7h7v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-4h-1Zm-14,16h-1v1h-3v-1h-1v-3h1v-1h1v1h1v1h1v1h1v1Zm9-9h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h2v1h1v1h1v2Zm1-3v-1h-1v-1h-1v-2h1v-1h2v1h1v1h1v2h-1v1h-2Z" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="font-departureMono uppercase text-[12px] text-white">What’s so special?</p>
                      <p className="font-departureMono text-[10px] text-textSecondary">
                        I guess it’s the fact that I’m not making this as a business. I just wanted a cool site to find
                        new fantasy and sci-fi books.
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
                    <div className="flex flex-col gap-2">
                      <p className="font-departureMono uppercase text-[12px] text-black">Who made it?</p>
                      <img src="/images/me.png" alt="just a little pixelart rendering of me..." className="h-[200px]" />
                      <p className="font-departureMono text-[10px] text-[rgba(0,0,0,0.4)]">
                        Oh yeah, I’m Callum. I’m just a guy based in the UK.
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
            <div className="flex flex-col items-start px-4 py-[10px]">
              <p className="font-departureMono uppercase text-[10px] text-textSecondary">Get In</p>
              <a className="font-departureMono uppercase text-[12px] flex gap-1">
                <span className="text-[#FF3131]">♥</span> Contact
              </a>
            </div>
          </nav>
        </motion.div>
        {isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              bounce: 0.5,
              duration: 0.8
            }}
            className=""
          >
            <button className="bg-black h-12 px-5 rounded-[8px] flex items-center justify-center w-auto flex-col">
              <p className="font-departureMono uppercase text-[10px] text-textSecondary whitespace-nowrap">
                Super Secret
              </p>
              <p className="font-departureMono uppercase text-[12px] text-white whitespace-nowrap">Admin Tools</p>
            </button>
          </motion.div>
        )}
      </div>
      <AnimatePresence>
        {isPopoverVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              bounce: 0.5,
              duration: 0.6
            }}
            className="fixed inset-0 bg-[rgba(0,0,0,0.2)] backdrop-blur-[0px] pointer-events-none z-30"
          />
        )}
      </AnimatePresence>
    </>
  )
}

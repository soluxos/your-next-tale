"use client"

import { motion } from "framer-motion"

export default function Navigation({ isLoggedIn = false }) {
  return (
    <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-[10px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white h-12 py-[10px] px-5 border-solid border-gray-300 border-[1px] rounded-[8px] flex items-center gap-4 w-auto"
      >
        <div className="flex flex-col items-start">
          <a className="font-departureMono uppercase text-[12px]">Your Next Tale</a>
          <p className="font-departureMono uppercase text-textSecondary text-[10px] whitespace-nowrap">
            Curated fantasy & sci-fi books
          </p>
        </div>
        <nav className="flex items-center gap-4">
          <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
          <div className="flex flex-col items-start">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">Go</p>
            <a className="font-departureMono uppercase text-[12px] flex gap-1">
              <span className="text-[#2CA7FF]">♦</span> Home
            </a>
          </div>
          <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
          <div className="flex flex-col items-start">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">All</p>
            <a className="font-departureMono uppercase text-[12px] flex gap-1">
              <span className="text-[#2BD26B]">✦</span> About
            </a>
          </div>
          <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
          <div className="flex flex-col items-start">
            <p className="font-departureMono uppercase text-[10px] text-textSecondary">Get In</p>
            <a className="font-departureMono uppercase text-[12px] flex gap-1">
              <span className="text-[#FF3131]">♥</span> Contact
            </a>
          </div>
        </nav>
      </motion.div>
      {isLoggedIn && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
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
  )
}

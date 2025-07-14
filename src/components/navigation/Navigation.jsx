"use client"

import { motion } from "framer-motion"

export default function Navigation() {
  return (
    <div className="fixed bottom-5 flex items-center justify-center w-full z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] bg-white h-12 px-5 border-solid border-gray-300 border-[1px] rounded-full flex items-center"
      >
        <div>
          <a className="font-departureMono uppercase text-[14px]">Your Next Tale</a>
          <p className="font-departureMono uppercase text-textSecondary text-[12px]">Curated fantasy & sci-fi books</p>
        </div>
      </motion.div>
    </div>
  )
}

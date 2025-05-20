import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const HoverFollowDialog = ({ children, dialog, id, activeDialog, setActiveDialog }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [flipX, setFlipX] = useState(false)

  const OFFSET = 12
  const DIALOG_WIDTH = 200 // Estimate or adjust based on content

  const handleClick = (e) => {
    if (activeDialog === id) {
      setActiveDialog(null) // Hide dialog if already active
    } else {
      const x = e.clientX
      const y = e.clientY

      const willOverflowRight = x + OFFSET + DIALOG_WIDTH > window.innerWidth
      setFlipX(willOverflowRight)

      const finalX = willOverflowRight ? x - OFFSET - DIALOG_WIDTH : x + OFFSET

      setPos({ x: finalX, y: y + OFFSET })
      setActiveDialog(id) // Show dialog for this item
    }
  }

  return (
    <>
      <div className="inline-block" onClick={handleClick}>
        {children}
      </div>

      <AnimatePresence>
        {activeDialog === id && (
          <motion.div
            key="hover-dialog"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed pointer-events-none z-50 bg-white border border-gray-300 text-sm rounded-xl px-3 py-2 shadow-lg w-[200px]"
            style={{
              top: pos.y,
              left: pos.x,
              transformOrigin: flipX ? "top right" : "top left"
            }}
          >
            {dialog}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default HoverFollowDialog

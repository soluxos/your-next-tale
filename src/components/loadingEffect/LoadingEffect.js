import React from "react"
import { motion } from "motion/react"
import "./LoadingEffect.css"

export default function LoadingEffect() {
  return (
    <motion.div
      className="crt-effect"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} // Fade out and shrink when leaving
      transition={{ duration: 0.5 }} // Adjust duration as needed
    >
      <div className="scanline"></div>
    </motion.div>
  )
}

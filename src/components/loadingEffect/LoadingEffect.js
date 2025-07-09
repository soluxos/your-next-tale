import React, { useState, useEffect } from "react"
import { motion } from "motion/react"
import "./LoadingEffect.css"

export default function LoadingEffect() {
  const [loadingText, setLoadingText] = useState("LOADING...")

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingText((prev) => (prev === "LOADING..." ? "LOADING.." : "LOADING..."))
    }, 500) // Toggle every 500ms

    return () => clearInterval(interval) // Cleanup on unmount
  }, [])

  return (
    <motion.div
      className="crt-effect"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} // Fade out and shrink when leaving
      transition={{ duration: 0.5 }} // Adjust duration as needed
    >
      <div className="scanline"></div>
      <div className="font-departureMono text-white">{loadingText}</div>
    </motion.div>
  )
}

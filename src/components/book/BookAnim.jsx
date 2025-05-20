import React, { useState } from "react"
import { motion } from "framer-motion"

const BookOpenAnimation = () => {
  const [isOpen, setIsOpen] = useState(false)

  const handleBookClick = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="perspective">
        <motion.div className="relative w-40 h-60 cursor-pointer" onClick={handleBookClick}>
          {/* Front Cover */}
          <motion.div
            className="absolute w-full h-full bg-cover bg-center z-20 rounded-lg shadow-xl transform-style-preserve-3d backface-hidden"
            style={{
              backgroundImage: "url('blob:http://localhost:3000/cb7726f5-8128-4fb9-bce1-8fbbb7e48224')"
            }}
            animate={{
              rotateY: isOpen ? -160 : 0,
              transformOrigin: "left center"
            }}
            transition={{ duration: 1 }}
          />

          {/* Pages */}
          <div className="absolute w-full h-full bg-white z-10 rounded-lg shadow-inner" />
        </motion.div>
      </div>
    </div>
  )
}

export default BookOpenAnimation

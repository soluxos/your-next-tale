"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import AboutPopover from "./AboutPopover";

export default function Navigation({ isLoggedIn = false }) {
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);

  const handleMouseEnter = () => {
    setIsPopoverVisible(true);
  };

  const handleMouseLeave = () => {
    setIsPopoverVisible(false);
  };

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
            <p className="font-departureMono uppercase text-[12px]">
              Your Next Tale
            </p>
            <p className="font-departureMono uppercase text-textSecondary text-[10px] whitespace-nowrap">
              Curated fantasy & sci-fi books
            </p>
          </a>
          {/* <nav className="flex items-center"> */}
          {/* <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
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
            <AboutPopover isPopoverVisible={isPopoverVisible} handleMouseLeave={handleMouseLeave} /> */}
          {/* <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
            <div className="flex flex-col items-start px-4 py-[10px]">
              <p className="font-departureMono uppercase text-[10px] text-textSecondary">Get In</p>
              <a className="font-departureMono uppercase text-[12px] flex gap-1">
                <span className="text-[#FF3131]">♥</span> Contact
              </a>
            </div> */}
          {/* <div className="separator w-[1px] h-6 bg-[#ECECEC]" />
            <a href="/" className="flex flex-col items-start px-4 py-[10px]">
              <p className="font-departureMono uppercase text-[10px] text-textSecondary">Head</p>
              <p className="font-departureMono uppercase text-[12px] flex gap-1">
                <span className="text-[#2CA7FF]">♦</span> Home
              </p>
            </a> */}
          {/* </nav> */}
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
              <p className="font-departureMono uppercase text-[12px] text-white whitespace-nowrap">
                Admin Tools
              </p>
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
  );
}

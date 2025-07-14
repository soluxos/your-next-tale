"use client"
import React, { useEffect, useState, useRef } from "react"
import { motion } from "motion/react"
import { createClient } from "@/utils/supabase/client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import BookPopover from "@/components/book/BookPopover.jsx"
import BookDrawer from "@/components/book/BookDrawer.jsx"

const Book = (props) => {
  const [coverUrl, setCoverUrl] = useState(null)
  const { book, onImageLoad } = props
  const { id, title, cover_url, author, description } = book
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Ref for controlling the BookDrawer
  const drawerRef = useRef()

  useEffect(() => {
    const downloadImage = async (path) => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase.storage.from("books").download(path)
        if (error) {
          console.log("Error downloading image: ", error)
          throw error
        }

        const url = URL.createObjectURL(data)
        setCoverUrl(url)
      } catch (error) {
        console.log("Error downloading image: ", error)
      }
    }

    if (cover_url) {
      downloadImage(cover_url)
    }
  }, [cover_url])

  const handleMouseEnter = () => {
    setIsPopoverOpen(true)
  }

  const handleMouseLeave = () => {
    setIsPopoverOpen(false)
  }

  // Function to open the drawer
  const openDrawer = () => {
    if (drawerRef.current) {
      drawerRef.current.open()
    }
  }

  return (
    <>
      <BookDrawer ref={drawerRef} book={book} coverUrl={coverUrl} />

      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className="relative transition-all duration-200 ease-in-out cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={openDrawer}
          >
            <div className="flex flex-col gap-1 relative z-10" key={id}>
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={`${title} cover`}
                  className={`w-full h-auto shadow-[0_0_64px_8px_rgba(0,0,0,0.2)] transform transition-all duration-200 ease-in-out rounded-sm ${
                    isPopoverOpen ? "-translate-y-2" : "hover:-translate-y-2"
                  }`}
                  onLoad={onImageLoad}
                />
              )}
            </div>
            <div className="w-full h-full absolute top-0 left-0 z-0"></div>
            {/* Invisible buffer area */}
            <div className="absolute bottom-[-8px] left-0 w-full h-2 bg-transparent"></div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="book-popover w-[480px] max-w-full p-4 bg-white shadow-lg rounded-lg"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <BookPopover book={book} onOpenDrawer={openDrawer} />
        </PopoverContent>
      </Popover>
    </>
  )
}

export default Book

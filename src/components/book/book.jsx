"use client"
import React, { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import BookPopover from "@/components/book/BookPopover.jsx"

const Book = (props) => {
  const [coverUrl, setCoverUrl] = useState(null)
  const { id, title, cover_url, author, description } = props
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

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

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={`relative shadow-[0_0_64px_8px_rgba(0,0,0,0.2)] rounded-sm overflow-hidden transition-all duration-200 ease-in-out cursor-pointer transform ${
              isPopoverOpen ? "-translate-y-2" : "hover:-translate-y-2"
            }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex flex-col gap-1 relative z-10" key={id}>
              {coverUrl && <img src={coverUrl} alt={`${title} cover`} className="w-full h-auto" />}
            </div>
            <div className="w-full h-full absolute top-0 left-0 z-0"></div>
            {/* Invisible buffer area */}
            <div className="absolute bottom-[-8px] left-0 w-full h-2 bg-transparent"></div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[480px] p-4 bg-white shadow-lg rounded-lg"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <BookPopover
            title={title}
            author={author}
            description={description}
            onViewDetails={() => {
              console.log("View all details clicked")
            }}
            onPurchase={() => {
              console.log("Purchase this book clicked")
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

export default Book

"use client"
import React, { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

const BookSimple = (props) => {
  const [coverUrl, setCoverUrl] = useState(null)
  const { book, onImageLoad } = props
  const { cover_url, title } = book

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

  return (
    <div className="flex flex-col gap-1">
      {coverUrl && (
        <img
          src={coverUrl}
          alt={`${title} cover`}
          className="w-full h-auto shadow-[0_0_64px_8px_rgba(0,0,0,0.2)] transform transition-all duration-200 ease-in-out rounded-sm"
          onLoad={onImageLoad}
        />
      )}
      <p className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">{title}</p>
    </div>
  )
}

export default BookSimple

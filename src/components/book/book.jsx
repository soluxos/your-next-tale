"use client"
import React, { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

const Book = ({ title, cover_url, id, description, author }) => {
  const [coverUrl, setCoverUrl] = useState(null)

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
    <div className="flex flex-col gap-1" key={id}>
      {coverUrl && <img src={coverUrl} alt={`${title} cover`} className="w-40 h-auto" />}
      <div className="book-details">
        <h3 className="book-title">{title}</h3>
        {/* <p className="book-author">by {author}</p>
        <p className="book-description">{description}</p> */}
      </div>
    </div>
  )
}

export default Book

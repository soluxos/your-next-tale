"use client"
import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import BookUpload from "./BookUpload"

const AddBookForm = () => {
  const supabase = createClient()
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [description, setDescription] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [uploadKey, setUploadKey] = useState(Date.now()) // Add a key to reset BookUpload

  const handleSubmit = async (event) => {
    event.preventDefault()

    const { data, error } = await supabase.from("Books").insert([{ title, author, description, cover_url: coverUrl }])

    if (error) {
      console.error("Error adding book:", error)
    } else {
      console.log("Book added:", data)
      alert("Book added successfully!")

      // Reset form fields
      setTitle("")
      setAuthor("")
      setDescription("")
      setCoverUrl("")

      // Reset the upload component by changing its key
      setUploadKey(Date.now())
    }
  }

  return (
    <div>
      <h1>Add New Book</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-96 mx-auto">
        <div className="w-full">
          <label htmlFor="title">Title:</label>
          <input
            className="w-full"
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="w-full">
          <label htmlFor="author">Author:</label>
          <input
            className="w-full"
            type="text"
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
          />
        </div>
        <div className="w-full">
          <label htmlFor="description">Description:</label>
          <textarea
            className="w-full"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          ></textarea>
        </div>
        <div className="w-full">
          {/* Reset BookUpload by changing the key */}
          <BookUpload key={uploadKey} url={coverUrl} size={150} onUpload={(url) => setCoverUrl(url)} />
          <input
            className="opacity-0 w-0 h-0"
            type="text"
            id="coverUrl"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            required
          />
        </div>
        <button className="bg-orange-500 text-white p-4" type="submit">
          Add Book
        </button>
      </form>
    </div>
  )
}

export default AddBookForm

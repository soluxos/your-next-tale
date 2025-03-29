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
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Title:</label>
          <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="author">Author:</label>
          <input type="text" id="author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          ></textarea>
        </div>
        <div>
          {/* Reset BookUpload by changing the key */}
          <BookUpload key={uploadKey} url={coverUrl} size={150} onUpload={(url) => setCoverUrl(url)} />
          <label htmlFor="coverUrl">Cover URL:</label>
          <input type="text" id="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} required />
        </div>
        <button type="submit">Add Book</button>
      </form>
    </div>
  )
}

export default AddBookForm

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-lg border border-solid border-gray-300">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center border-b border-solid border-gray-300 pb-4">
          Add New Book
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Title Input */}
          <div className="w-full">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title:
            </label>
            <input
              className="w-full border border-solid border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Author Input */}
          <div className="w-full">
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Author:
            </label>
            <input
              className="w-full border border-solid border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
          </div>

          {/* Description Input */}
          <div className="w-full">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description:
            </label>
            <textarea
              className="w-full border border-solid border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              required
            ></textarea>
          </div>

          {/* Cover Upload */}
          <div className="w-full">
            <label htmlFor="coverUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image:
            </label>
            <div className="border border-solid border-gray-300 rounded-lg p-4">
              <BookUpload key={uploadKey} url={coverUrl} size={150} onUpload={(url) => setCoverUrl(url)} />
            </div>
            <input
              className="opacity-0 w-0 h-0 border border-solid border-gray-300"
              type="text"
              id="coverUrl"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition duration-200 border border-solid border-orange-600"
            type="submit"
          >
            Add Book
          </button>
        </form>
      </div>
    </div>
  )
}

export default AddBookForm

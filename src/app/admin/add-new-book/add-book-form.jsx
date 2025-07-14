"use client"
import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import BookUpload from "./BookUpload"
import BookSimple from "@/components/book/BookSimple"

const AddBookForm = () => {
  const supabase = createClient()
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [description, setDescription] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [amazonAffiliateLink, setAmazonAffiliateLink] = useState("") // New state for affiliate link
  const [uploadKey, setUploadKey] = useState(Date.now()) // Add a key to reset BookUpload
  const [similarBooks, setSimilarBooks] = useState([]) // State to store similar books

  const checkSimilarTitles = async (title) => {
    // Trim whitespace and check if the input is meaningful and has more than 2 characters
    if (title.trim().length <= 2) {
      setSimilarBooks([]) // Clear similar books if input is empty, just whitespace, or too short
      return
    }

    const { data, error } = await supabase
      .from("Books")
      .select("*") // Fetch all book details
      .ilike("title", `%${title}%`) // Case-insensitive partial match

    if (error) {
      console.error("Error checking similar titles:", error)
      return
    }

    setSimilarBooks(data) // Store the full book objects
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const { data, error } = await supabase.from("Books").insert([
      {
        title,
        author,
        description,
        cover_url: coverUrl,
        amazon_affiliate_link: amazonAffiliateLink // Include affiliate link
      }
    ])

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
      setAmazonAffiliateLink("") // Reset affiliate link field

      // Reset the upload component by changing its key
      setUploadKey(Date.now())
      setSimilarBooks([]) // Clear similar books
    }
  }

  return (
    <div className="bg-[#0D00FF] p-5 pt-10 max-w-[401px] flex flex-col gap-5 min-h-full flex-grow">
      <div className="flex flex-col gap-2">
        <h1 className="text-primary font-departureMono uppercase text-[20px] text-white">Add New Book</h1>
        <p className="text-primary font-departureMono uppercase text-[12px] text-white">
          Hey buddy, i’m sorry I look like a windows error screen. Just add a book...
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 justify-between flex-grow h-full">
        <div className="flex flex-col gap-6">
          {/* Title Input */}
          <div className="w-full">
            <label htmlFor="title" className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">
              Title:
            </label>
            <input
              className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
              type="text"
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                checkSimilarTitles(e.target.value) // Check for similar titles
              }}
              required
            />
            {similarBooks.length > 0 && (
              <div className="mt-2 text-sm text-white">
                <p className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">
                  Similar titles found:
                </p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {similarBooks.map((book) => (
                    <div key={book.id}>
                      <BookSimple book={book} onImageLoad={() => {}} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Author Input */}
          <div className="w-full">
            <label htmlFor="author" className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">
              Author:
            </label>
            <input
              className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
          </div>

          {/* Description Input */}
          <div className="w-full">
            <label
              htmlFor="description"
              className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
            >
              Description:
            </label>
            <textarea
              className="w-full border border-solid border-white px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              required
            ></textarea>
          </div>

          {/* Cover Upload */}
          <div className="w-full">
            <label htmlFor="coverUrl" className="text-primary font-departureMono uppercase text-[12px] text-white mb-1">
              Cover Image:
            </label>
            <div className="border border-solid border-white p-4 bg-transparent flex items-center gap-4">
              <BookUpload
                key={uploadKey}
                url={coverUrl}
                size={150}
                onUpload={(url) => setCoverUrl(url)} // Handle the uploaded file URL
              />
            </div>
            <input
              className="opacity-0 w-0 h-0"
              type="text"
              id="coverUrl"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              required
            />
          </div>

          {/* Amazon Affiliate Link Input */}
          <div className="w-full">
            <label
              htmlFor="amazonAffiliateLink"
              className="text-primary font-departureMono uppercase text-[12px] text-white mb-1"
            >
              Amazon Affiliate Link:
            </label>
            <input
              className="w-full border border-solid border-white h-[32px] px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-transparent text-white font-departureMono text-[12px]"
              type="text"
              id="amazonAffiliateLink"
              value={amazonAffiliateLink}
              onChange={(e) => setAmazonAffiliateLink(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] h-[48px] px-6 transition duration-200 border border-solid border-[#0D00FF] hover:bg-gray-200"
          type="submit"
        >
          Add the book pls
        </button>
      </form>
    </div>
  )
}

export default AddBookForm

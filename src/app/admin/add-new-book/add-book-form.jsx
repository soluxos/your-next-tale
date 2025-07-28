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
  const [amazonAffiliateLink, setAmazonAffiliateLink] = useState("")
  const [uploadKey, setUploadKey] = useState(Date.now())
  const [similarBooks, setSimilarBooks] = useState([])

  const checkSimilarTitles = async (title) => {
    if (title.trim().length <= 2) {
      setSimilarBooks([])
      return
    }

    const { data, error } = await supabase.from("Books").select("*").ilike("title", `%${title}%`)

    if (error) {
      console.error("Error checking similar titles:", error)
      return
    }

    setSimilarBooks(data)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    const trimmedAuthor = author.trim()
    const trimmedDescription = description.trim()
    const trimmedCoverUrl = coverUrl.trim()
    const trimmedAmazonAffiliateLink = amazonAffiliateLink.trim()

    const { data, error } = await supabase.from("Books").insert([
      {
        title: trimmedTitle,
        author: trimmedAuthor,
        description: trimmedDescription,
        cover_url: trimmedCoverUrl,
        amazon_affiliate_link: trimmedAmazonAffiliateLink
      }
    ])

    if (error) {
      console.error("Error adding book:", error)
    } else {
      console.log("Book added:", data)
      alert("Book added successfully!")

      setTitle("")
      setAuthor("")
      setDescription("")
      setCoverUrl("")
      setAmazonAffiliateLink("")
      setUploadKey(Date.now())
      setSimilarBooks([])
    }
  }

  return (
    <div className="submit-form bg-[#0D00FF] p-5 pt-10 max-w-[401px] flex flex-col gap-5 h-[100vh] min-h-full flex-grow fixed z-[1000] overflow-scroll">
      <div className="flex flex-col gap-2">
        <h1 className="text-primary font-departureMono uppercase text-[20px] text-white">Add New Book</h1>
        <p className="text-primary font-departureMono uppercase text-[12px] text-white">
          Hey buddy, i’m sorry I look like a windows error screen. Just add a book...
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 justify-between flex-grow h-auto">
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
                checkSimilarTitles(e.target.value)
              }}
              onBlur={(e) => {
                const trimmedValue = e.target.value.trim()
                setTitle(trimmedValue)
              }}
              required
            />
          </div>

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
              onBlur={(e) => setAuthor(e.target.value.trim())}
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
              onBlur={(e) => setDescription(e.target.value.trim())}
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
              <BookUpload key={uploadKey} url={coverUrl} size={150} onUpload={(url) => setCoverUrl(url.trim())} />
            </div>
            <input
              className="opacity-0 w-0 h-0"
              type="text"
              id="coverUrl"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              onBlur={(e) => setCoverUrl(e.target.value.trim())}
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
              onBlur={(e) => setAmazonAffiliateLink(e.target.value.trim())}
              required
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] min-h-[48px] px-6 transition duration-200 border border-solid border-[#0D00FF] hover:bg-gray-200"
          type="submit"
        >
          Add the book pls
        </button>
      </form>
    </div>
  )
}

export default AddBookForm

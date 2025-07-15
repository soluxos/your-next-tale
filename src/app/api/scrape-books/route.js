import { NextResponse } from "next/server"
import fetch from "node-fetch"

export async function POST(req) {
  try {
    const body = await req.json()
    const { title } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=3`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error("Failed to fetch data from Google Books API")
    }

    const data = await response.json()

    const results =
      data.items?.map((item) => ({
        title: item.volumeInfo.title || "No title available",
        subtitle: item.volumeInfo.subtitle || null,
        authors: item.volumeInfo.authors || ["Unknown author"],
        description: item.volumeInfo.description || "No description available",
        categories: item.volumeInfo.categories || ["Uncategorized"],
        publisher: item.volumeInfo.publisher || "Unknown publisher",
        publishedDate: item.volumeInfo.publishedDate || "Unknown date",
        pageCount: item.volumeInfo.pageCount || 0,
        language: item.volumeInfo.language || "Unknown language",
        isbn: item.volumeInfo.industryIdentifiers?.map((id) => `${id.type}: ${id.identifier}`) || [],
        averageRating: item.volumeInfo.averageRating || null,
        ratingsCount: item.volumeInfo.ratingsCount || 0,
        maturityRating: item.volumeInfo.maturityRating || "NOT_MATURE",
        thumbnail: item.volumeInfo.imageLinks?.thumbnail || null,
        previewLink: item.volumeInfo.previewLink || null,
        link: item.volumeInfo.infoLink || null
      })) || []

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

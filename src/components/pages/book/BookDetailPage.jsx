"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Navigation from "@/components/navigation/Navigation";

export default function BookDetailPage({ book }) {
  const [coverUrl, setCoverUrl] = useState(null);
  const { title, author, description, amazon_affiliate_link, cover_url } = book;

  useEffect(() => {
    const downloadImage = async (path) => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.storage
          .from("books")
          .download(path);
        if (error) {
          console.log("Error downloading image: ", error);
          throw error;
        }

        const url = URL.createObjectURL(data);
        setCoverUrl(url);
      } catch (error) {
        console.log("Error downloading image: ", error);
      }
    };

    if (cover_url) {
      downloadImage(cover_url);
    }
  }, [cover_url]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-bookLightDark to-bookLightLight">
        <div className="grid grid-cols-[16px_auto_16px]">
          <div className="w-4 h-full border border-solid border-border"></div>
          <div className="flex-1 flex-col w-full">
            <div className="w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>

            {/* Back button */}
            <div className="p-4 md:p-8">
              <Button asChild variant="outline" className="font-departureMono">
                <Link href="/">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Library
                </Link>
              </Button>
            </div>

            {/* Book content */}
            <div className="flex flex-col lg:flex-row gap-8 p-4 md:p-8 pb-24">
              {/* Book cover */}
              <div className="flex-shrink-0 lg:w-1/3 flex justify-center lg:justify-start">
                <div className="bg-[#F4F3FF] p-8 rounded-lg w-full max-w-md">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`${title} cover`}
                      className="w-full h-auto shadow-[0_0_64px_8px_rgba(0,0,0,0.2)] rounded-sm"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-200 animate-pulse rounded-sm"></div>
                  )}
                </div>
              </div>

              {/* Book details */}
              <div className="flex-1 flex flex-col gap-6 max-w-2xl">
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl text-textPrimary font-ppMondwest mb-2">
                    {title}
                  </h1>
                  <p className="text-xl md:text-2xl font-ppMondwest text-textSecondary">
                    By <span className="text-textPrimary">{author}</span>
                  </p>
                </div>

                <div className="w-full h-px border-t border-border"></div>

                <div className="text-base md:text-lg leading-relaxed font-ppMondwest text-textSecondary">
                  {description
                    ? description.split("\n").map((paragraph, index) => (
                        <p key={index} className="mb-4">
                          {paragraph}
                        </p>
                      ))
                    : "No description available."}
                </div>

                {amazon_affiliate_link && (
                  <Button
                    asChild
                    className="w-full md:w-auto text-sm items-center h-[48px] flex justify-center font-departureMono uppercase font-normal text-[13px] mt-4"
                    variant="default"
                  >
                    <a
                      href={amazon_affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buy on Amazon{" "}
                      <img
                        src="/icons/trolley.svg"
                        alt="cart"
                        className="ml-2"
                      />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
          </div>
          <div className="w-4 h-full border border-solid border-border"></div>
        </div>
      </div>
      <Navigation isLoggedIn={false} />
    </>
  );
}

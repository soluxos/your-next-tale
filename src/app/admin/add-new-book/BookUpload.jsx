"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";

export default function BookUpload({ url, onUpload }) {
  const supabase = createClient();
  const [bookUrl, setBook] = useState(url);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function downloadImage(path) {
      try {
        const { data, error } = await supabase.storage
          .from("books")
          .download(path);
        if (error) {
          throw error;
        }

        const url = URL.createObjectURL(data);
        setBook(url);
      } catch (error) {
        console.log("Error downloading image: ", error);
      }
    }

    if (url) downloadImage(url);
  }, [url, supabase]);

  const uploadAvatar = async (event) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("books")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      onUpload(filePath);
    } catch (error) {
      console.log("Error uploading book cover: ", error);
      alert("Error uploading cover!");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="BookUpload w-full">
      <div className="bg-transparent flex flex-col items-start gap-4">
        {bookUrl && (
          <img
            src={bookUrl}
            alt="Book Cover"
            className="w-auto h-[150px] object-cover"
          />
        )}
        <div className="flex flex-row gap-2 items-center">
          <label
            htmlFor="fileUpload"
            className="bg-[#1f1f1f] text-white font-departureMono uppercase text-[12px] py-2 px-4 cursor-pointer"
          >
            {uploading ? "Uploading..." : "Browse"}
          </label>
          <p className="text-textSecondary font-departureMono uppercase text-[12px]">
            No file selected
          </p>
          <input
            id="fileUpload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
          />
        </div>
      </div>
    </div>
  );
}

import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import Navigation from "../components/navigation/Navigation"; // Import the Navigation component
import { createClient } from "@/utils/supabase/server";
import TopNavigation from "@/components/navigation/TopNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter" // optional if using with Tailwind
});

export const metadata = {
  title: "Your Next Tale",
  description: "Discover your next favorite book with our curated book case.",
  openGraph: {
    title: "Your Next Tale",
    description: "Discover your next favorite book with our curated book case.",
    url: "https://yournexttale.com", // Replace with your actual URL
    type: "website",
    images: [
      {
        url: "https://yournexttale.com/thumbnail-1200-630.png", // Absolute URL for the social share image
        width: 1200,
        height: 630,
        alt: "Your Next Tale Social Share Image"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Your Next Tale",
    description: "Discover your next favorite book with our curated book case.",
    images: ["https://yournexttale.com/thumbnail-1200-630.png"] // Absolute URL for the social share image
  },
  icons: {
    icon: "/favicon.svg" // Path to your favicon
  }
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser(); // Use getUser() for secure authentication

  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-foreground relative`}
      >
        <div aria-hidden="true" className="noise-overlay" />
        <TopNavigation user={user} />
        {children}
        <Script src="https://scripts.simpleanalyticscdn.com/latest.js" />
      </body>
    </html>
  );
}

import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import Navigation from "../components/navigation/Navigation"; // Import the Navigation component
import { createClient } from "@/utils/supabase/server";
import TopNavigation from "@/components/navigation/TopNavigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

const ppMondwest = localFont({
  src: "../../public/fonts/PPMondwest-Regular.woff2",
  variable: "--font-pp-mondwest",
  display: "block"
});

const departureMono = localFont({
  src: "../../public/fonts/departuremono-regular-webfont.woff2",
  variable: "--font-departure-mono",
  display: "block"
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
    <html lang="en" className={`${inter.variable} ${ppMondwest.variable} ${departureMono.variable}`}>
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

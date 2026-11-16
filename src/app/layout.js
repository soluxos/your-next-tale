import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";
import TopNavigation from "@/components/navigation/TopNavigation";
import Footer from "@/components/navigation/Footer";
import { AuthProvider } from "@/components/providers/AuthProvider";
import UIOverlays from "@/components/providers/UIOverlays";
import { LibraryProvider } from "@/components/providers/LibraryProvider";
import { Toaster } from "sonner";

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

const satoshi = localFont({
  src: [
    {
      path: "../../public/fonts/Satoshi-Light.woff2",
      weight: "300",
      style: "normal"
    },
    {
      path: "../../public/fonts/Satoshi-LightItalic.woff2",
      weight: "300",
      style: "italic"
    },
    {
      path: "../../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "../../public/fonts/Satoshi-Italic.woff2",
      weight: "400",
      style: "italic"
    },
    {
      path: "../../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal"
    },
    {
      path: "../../public/fonts/Satoshi-MediumItalic.woff2",
      weight: "500",
      style: "italic"
    },
    {
      path: "../../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal"
    },
    {
      path: "../../public/fonts/Satoshi-BoldItalic.woff2",
      weight: "700",
      style: "italic"
    },
    {
      path: "../../public/fonts/Satoshi-Black.woff2",
      weight: "900",
      style: "normal"
    },
    {
      path: "../../public/fonts/Satoshi-BlackItalic.woff2",
      weight: "900",
      style: "italic"
    }
  ],
  variable: "--font-satoshi",
  display: "swap"
});

export const metadata = {
  title: "Your Next Tale",
  description:
    "A beautiful bookcase for everything you read — shelve, track, rate and share your books.",
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

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ppMondwest.variable} ${departureMono.variable} ${satoshi.variable}`}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-foreground relative bg-white`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[300] btn btn-primary"
        >
          Skip to content
        </a>
        <AuthProvider>
          <LibraryProvider>
            <UIOverlays />
            <TopNavigation />
            <main id="main" tabIndex={-1} className="pt-16 outline-none">
              {children}
            </main>
            <Footer />
          </LibraryProvider>
        </AuthProvider>
        <Toaster
          theme="light"
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-[12px] !border-line !shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] !font-departureMono !uppercase !text-[11px] !text-ink !gap-2",
              description:
                "!font-ppMondwest !normal-case !text-[15px] !text-textSecondary",
              actionButton:
                "!font-departureMono !uppercase !text-[11px] !bg-ink !rounded-[6px] !h-7 !px-2.5"
            }
          }}
        />
        <Script src="https://scripts.simpleanalyticscdn.com/latest.js" />
      </body>
    </html>
  );
}

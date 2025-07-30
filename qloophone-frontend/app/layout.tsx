import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

// Use next/font to handle the Inter font loading and optimization.
// This creates a CSS variable (--font-inter) that tailwind.config.ts already uses.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "qloofone",
  description: "Two Tastes. One Pick.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preload" href="/fonts/helvetiker_bold.typeface.json" as="fetch" crossOrigin="anonymous" />
      </head>
      {/* The font variable is applied to the body tag */}
      <body className={cn("font-sans antialiased", inter.variable)}>{children}</body>
    </html>
  )
}

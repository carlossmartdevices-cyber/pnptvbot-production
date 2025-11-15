import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/common/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PNPtv - Your Entertainment Hub",
  description: "Live streaming, radio, Zoom rooms, and social networking platform",
  keywords: ["streaming", "radio", "live", "zoom", "social", "entertainment"],
  authors: [{ name: "PNPtv Team" }],
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#a855f7" },
    { media: "(prefers-color-scheme: dark)", color: "#7c3aed" }
  ],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "PNPtv - Your Entertainment Hub",
    description: "Live streaming, radio, Zoom rooms, and social networking platform",
    siteName: "PNPtv",
  },
  twitter: {
    card: "summary_large_image",
    title: "PNPtv - Your Entertainment Hub",
    description: "Live streaming, radio, Zoom rooms, and social networking platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

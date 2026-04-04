import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AnimationProvider } from "@/components/providers/animation-provider";
import "./globals.css";


const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://127.0.0.1:3000";

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Lumina LMS",
    template: "%s | Lumina LMS",
  },
  description: "Advanced Library Management System for modern institutions. Track books, manage circulation, and generate reports.",
  keywords: ["Library Management", "LMS", "Education", "Inventory", "Books", "Digital Assets"],
  authors: [{ name: "Lumina Team" }],
  creator: "Lumina LMS",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: defaultUrl,
    title: "Lumina LMS - Modern Library Management",
    description: "Streamlined library operations for schools and organizations.",
    siteName: "Lumina LMS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumina LMS",
    description: "Modern Library Management System",
  },
};

const appSans = Manrope({
  variable: "--font-app-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${appSans.className} antialiased`}>
        <AnimationProvider>
          {children}
        </AnimationProvider>
        <Toaster position="bottom-right" richColors />
        <SpeedInsights />
      </body>
    </html>
  );
}

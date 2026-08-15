import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DevTools from "@/components/ui/DevTools";
import SessionProvider from "@/components/providers/SessionProvider";
import FMProvider from "@/components/providers/FMProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Product Recall Tracker",
  description: "AI-powered product recall discovery and response tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <FMProvider>
            {children}
            <DevTools />
          </FMProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

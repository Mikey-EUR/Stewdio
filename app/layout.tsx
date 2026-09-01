import AppChrome from "@/components/nav/AppChrome";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stewdio — Your personal kitchen studio",
  description: "Plan, shop, and cook with your personal recipe collection.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAF8F2]">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}



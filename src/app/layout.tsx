import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AskShapi from "@/components/AskShapi";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Shapi — Shape what's next",
  description: "The verified hiring platform built for the world that's coming. For every person navigating what AI means for their career, and every company trying to hire the humans who'll take them forward.",
  openGraph: {
    title: "Shapi — Shape what's next",
    description: "The verified hiring platform built for the world that's coming.",
    url: "https://shapi.io",
    siteName: "Shapi",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-jakarta)]">
        {children}
        <AskShapi />
      </body>
    </html>
  );
}

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
  metadataBase: new URL("https://shapi.io"),
  title: "Shapi — Shape what's next",
  description:
    "Stop guessing. Hire what's proven. Shapi verifies references independently, proves skills with evidence, and scores the companies doing the hiring — so both sides decide on facts.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Shapi — Shape what's next",
    description: "Stop guessing. Hire what's proven. The verification layer for hiring.",
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

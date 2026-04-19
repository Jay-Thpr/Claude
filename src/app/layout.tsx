import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SafeStep",
  description:
    "A browser-style SafeStep prototype that helps older adults with appointments, scam detection, and task memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} h-full overflow-y-auto`}>
      <body className="min-h-full overflow-y-auto bg-page text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}

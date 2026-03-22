import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Draper House Inventory",
  description: "Draper House private inventory capture app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning on <html> is intentional and scoped to this element only —
    // browser extensions (e.g. password managers, 1Password, Grammarly) inject attributes
    // like class/data-* onto <html> after hydration, which React would otherwise flag as
    // a mismatch. It does NOT suppress warnings inside the app tree.
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning needed because Grammarly injects data-gr-* attributes on <body> */}
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

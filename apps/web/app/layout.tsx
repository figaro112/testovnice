import "./globals.css";
import type { Metadata, Viewport } from "next";
import { withBasePath } from "../lib/site";

export const metadata: Metadata = {
  title: "PsychoTest | Kvantitatívna analýza",
  description: "Mobilný klikací test z kvantitatívnej analýzy v psychológii.",
  manifest: withBasePath("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PsychoTest",
  },
  icons: {
    icon: withBasePath("/icon.svg"),
    apple: withBasePath("/apple-icon.svg"),
  },
};

export const viewport: Viewport = {
  themeColor: "#184d40",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}

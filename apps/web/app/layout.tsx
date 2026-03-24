import "./globals.css";
import type { Metadata, Viewport } from "next";
import { withBasePath } from "../lib/site";

export const metadata: Metadata = {
  title: "MedTest",
  description: "Testovnice z mediciny pre web a iPhone.",
  manifest: withBasePath("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MedTest",
  },
  icons: {
    icon: withBasePath("/icon.svg"),
    apple: withBasePath("/apple-icon.svg"),
  },
};

export const viewport: Viewport = {
  themeColor: "#1d9b7c",
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

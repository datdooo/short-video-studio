import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShortCut Studio — AI Vertical Video Editor",
  description: "Turn long videos into polished vertical short-form stories with source-accurate edit plans.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}

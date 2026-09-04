import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamHub – Deine Streaming-Zentrale",
  description: "Filme, Serien und Anime aus allen deinen Streaming-Abos an einem Ort.",
  icons: { icon: "/streamhub-icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

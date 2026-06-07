import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "画话本 / SayDraw",
  description: "亲子语音故事画板 — Voice-powered story sketchpad for parents and preschoolers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}

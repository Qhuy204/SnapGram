import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapGram",
  description: "Turn diagram screenshots into editable Draw.io files."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

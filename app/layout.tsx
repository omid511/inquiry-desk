import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Inquiry Desk", description: "Turn messy service inquiries into clear next steps." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

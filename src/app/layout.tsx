import type { Metadata } from "next";
import "./globals.css";
import SidebarLayout from "@/components/SidebarLayout";

export const metadata: Metadata = {
  title: "CCTV Image Analysis Dashboard",
  description: "Analyze CCTV images using GPT-4o Vision API",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TopHeader } from "@/components/top-header";

export const metadata: Metadata = {
  title: "UCA Campus Hub",
  description: "Unified student dashboard for schedules, facilities, and bookings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopHeader />
          <main className="mx-auto min-h-screen w-full max-w-4xl p-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

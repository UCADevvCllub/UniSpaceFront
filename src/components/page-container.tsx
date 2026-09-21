"use client";

import { usePathname } from "next/navigation";

export function PageContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = pathname.startsWith("/lessons");

  return (
    <main className={`mx-auto min-h-screen w-full p-4 ${fullWidth ? "max-w-none" : "max-w-4xl"}`}>
      {children}
    </main>
  );
}

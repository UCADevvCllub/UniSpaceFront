"use client";

import { usePathname } from "next/navigation";

export function PageContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Same max-w-4xl column as TopHeader's nav, so page titles line up with the
  // SCHEDULES/LESSONS/BOOKING/CONTACTS links above them. Lessons only trims the top
  // padding so its title sits right under the header; the calendar itself breaks out
  // of this column separately (see the full-bleed wrapper in lessons/page.tsx).
  const isLessons = pathname.startsWith("/lessons");

  return (
    <main className={`mx-auto min-h-screen w-full max-w-4xl px-4 pb-4 ${isLessons ? "pt-2" : "pt-4"}`}>
      {children}
    </main>
  );
}

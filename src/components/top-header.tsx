"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import campusLogo from "../../photo/images.png";

const menuItems = [
  { href: "/schedules", label: "Schedules" },
  { href: "/lessons", label: "Lessons" },
  { href: "/booking", label: "Booking" },
  { href: "/contacts", label: "Contacts" },
];

export function TopHeader() {
  const pathname = usePathname();
  const { user, signIn, logOut, isAdmin } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/schedules" className="flex items-center gap-3">
          <Image src={campusLogo} alt="Campus icon" className="h-8 w-8 rounded-sm object-contain" />
          <div>
            <p className="text-lg font-bold uppercase tracking-wide text-slate-900">UCA Campus Hub</p>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Student Dashboard</p>
          </div>
        </Link>
        {user ? (
          <Button variant="outline" onClick={logOut}>
            Sign out
          </Button>
        ) : (
          <Button onClick={signIn}>Admin sign in</Button>
        )}
      </div>

      <nav className="mx-auto w-full max-w-4xl px-4">
        <ul className="flex flex-wrap gap-6 border-t border-slate-100 pt-3">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "inline-block border-b-2 pb-2 text-sm font-semibold uppercase tracking-wider text-slate-500",
                    active
                      ? "border-primary text-slate-900"
                      : "border-transparent hover:border-slate-300 hover:text-slate-700",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

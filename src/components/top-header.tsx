"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  const { user, signIn, logOut } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 sm:gap-4 px-3.5 py-3.5 sm:px-4 sm:py-4">
        <Link href="/schedules" className="flex items-center gap-2.5 sm:gap-3">
          <Image src={campusLogo} alt="Campus icon" className="h-[29px] w-[29px] sm:h-8 sm:w-8 rounded-sm object-contain" />
          <div>
            <p className="text-[16px] sm:text-lg font-bold uppercase tracking-wide text-slate-900 leading-tight sm:leading-normal">UCA Campus Hub</p>
            <p className="text-[10.8px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] text-slate-500">Student Dashboard</p>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a
            href="https://t.me/uca_hubbot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium text-slate-700 transition shadow-sm hover:border-slate-400"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true">
              <circle cx="12" cy="12" r="12" fill="#229ED9" />
              <path
                d="m5.491 11.74 11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953z"
                fill="#ffffff"
              />
            </svg>
            <span>Bot</span>
          </a>
          {user ? (
            <Button variant="outline" onClick={logOut} className="px-3.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Sign out
            </Button>
          ) : (
            <Button onClick={signIn} className="px-3.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Admin sign in
            </Button>
          )}
        </div>
      </div>

      <nav className="mx-auto w-full max-w-4xl px-3.5 sm:px-4">
        <ul className="flex justify-between border-t border-slate-100 pt-2.5 sm:pt-3">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "nav-link-hover inline-block pb-1.5 sm:pb-2 text-[12.6px] sm:text-sm font-semibold uppercase tracking-wide sm:tracking-wider text-slate-500",
                    active
                      ? "nav-link-active text-slate-900"
                      : "nav-link-inactive hover:text-slate-700",
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

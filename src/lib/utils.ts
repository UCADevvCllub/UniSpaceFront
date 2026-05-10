import { clsx, type ClassValue } from "clsx";
import { Timestamp } from "firebase/firestore";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEventTime(value: Date | Timestamp) {
  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isWithinNow(start: Date, end: Date, now: Date = new Date()) {
  return start <= now && end >= now;
}

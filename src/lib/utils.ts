import { clsx, type ClassValue } from "clsx";
import { Timestamp } from "firebase/firestore";
import { twMerge } from "tailwind-merge";
import { FreshmanLesson } from "@/app/lessons/page";

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

// my code

const dayMap: Record<string, any> = {
  'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY',
  'THU': 'THURSDAY', 'FRI': 'FRIDAY'
};

export const reverseDayMap: Record<string, string> = {
  'MONDAY': 'MON', 'TUESDAY': 'TUE', 'WEDNESDAY': 'WED',
  'THURSDAY': 'THU', 'FRIDAY': 'FRI'
};

export function mapDjangoToUi(djangoEvents: any[]): FreshmanLesson[] {
  return djangoEvents.map((ce) => ({
    id: ce.id.toString(),
    day: dayMap[ce.event_detail?.day] || 'MONDAY',
    
    // Use optional chaining
    startTime: ce.event_detail?.start_time?.slice(0, 5) ?? "00:00",
    endTime: ce.event_detail?.end_time?.slice(0, 5) ?? "00:00",
    
    title: ce.subject_detail?.name ?? "No Title",

    // Handle null instructor
    instructor: ce.instructor_detail 
      ? `${ce.instructor_detail.first_name} ${ce.instructor_detail.last_name}`
      : "TBD",

    // Handle null room 
    room: ce.room_detail?.room_number ?? "TBD",

    // Handle null cohort
    cohort: ce.cohort_detail?.cohort_name === 'CM' ? 'Cohort 1' : 'Cohort 2' 
  }));
}
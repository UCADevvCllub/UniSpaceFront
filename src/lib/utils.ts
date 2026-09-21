import { clsx, type ClassValue } from "clsx";
import { Timestamp } from "firebase/firestore";
import { twMerge } from "tailwind-merge";
// import { FreshmanLesson } from "@/app/lessons/page";

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


export const FRESHMAN_YEAR_ID = 1;

// The sub-columns inside each day column: Freshman splits CS into A and B, other years are CS | CM.
export function yearColumns(yearId: number): { label: string; cohort: string }[] {
  return yearId === FRESHMAN_YEAR_ID
    ? [
        { label: "CS A", cohort: "CS_A" },
        { label: "CS B", cohort: "CS_B" },
        { label: "CM", cohort: "CM" },
      ]
    : [
        { label: "CS", cohort: "CS" },
        { label: "CM", cohort: "CM" },
      ];
}

export function mapDjangoToUi(djangoEvents: any[]): any[] {
  const dayMap: any = { 'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY', 'THU': 'THURSDAY', 'FRI': 'FRIDAY' };

  return djangoEvents.map((ce) => {
    const yearId = ce.cohort_detail?.study_year_id;
    const cohortName: string = ce.cohort_detail?.cohort_name ?? "";
    const columns = yearColumns(yearId);
    // A cohort with its own column goes there; plain CS (Freshman) falls back to the first
    // column (CS A), anything CM-like to the last.
    const exact = columns.findIndex((c) => c.cohort === cohortName);
    const columnIndex = exact >= 0 ? exact : cohortName.startsWith('CM') ? columns.length - 1 : 0;

    return {
      id: ce.id.toString(),
      day: dayMap[ce.event_detail?.day] || 'MONDAY',
      startTime: ce.event_detail?.start_time?.slice(0, 5) ?? "00:00",
      endTime: ce.event_detail?.end_time?.slice(0, 5) ?? "00:00",
      title: ce.subject_detail?.name ?? "No Title",
      instructor: ce.instructor_detail ? `${ce.instructor_detail.first_name} ${ce.instructor_detail.last_name}` : "TBD",
      room: ce.room_detail?.room_number ?? "TBD",
      columnIndex,
      columnCount: columns.length,
      cohortName,
      // THIS IS THE CRITICAL PART: Match the ID from your Django JSON
      yearId,

      // Raw data
      subjectId: ce.subject_id,
      instructorId: ce.instructor_id,
      roomId: ce.room_id,
      cohortId: ce.cohort_id,
      linkedEventId: ce.linked_event_id != null ? String(ce.linked_event_id) : null
    };
  });
}
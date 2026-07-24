import axios from "axios";


import {
  QueryConstraint,
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CampusEvent, EventType } from "@/types/event";

const eventsCollection = collection(db, "events");

function hasValidTimestamp(value: unknown): value is { toDate: () => Date; toMillis: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  );
}

function hasValidTimeRange(event: Partial<CampusEvent>): event is CampusEvent {
  return hasValidTimestamp(event.start) && hasValidTimestamp(event.end);
}

export async function getEvents(filters?: {
  type?: EventType;
  group?: string;
  location?: string;
}) {
  const constraints: QueryConstraint[] = [limit(100)];

  if (filters?.type) constraints.push(where("type", "==", filters.type));
  if (filters?.group) constraints.push(where("group", "==", filters.group));
  if (filters?.location) constraints.push(where("location", "==", filters.location));

  const snapshot = await getDocs(query(eventsCollection, ...constraints));
  const rawEvents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Partial<CampusEvent>);
  return rawEvents.filter(hasValidTimeRange);
}

export function pickCurrentOrNextEvent(events: CampusEvent[], now = new Date()) {
  const sorted = events
    .slice()
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const current = sorted.find((event) => {
    const start = event.start.toDate();
    const end = event.end.toDate();
    return start <= now && end >= now;
  });

  if (current) return current;

  return sorted.find((event) => event.start.toDate() > now) ?? null;
}

export function findEmptyClassrooms(events: CampusEvent[], now = new Date()) {
  const validEvents = events.filter(hasValidTimeRange);
  const rooms = Array.from(
    new Set(
      validEvents
        .filter((event) => event.type === "lesson")
        .map((event) => event.location),
    ),
  );

  return rooms.filter((room) => {
    const roomEvents = validEvents.filter((event) => event.location === room);
    return !roomEvents.some((event) => {
      const start = event.start.toDate();
      const end = event.end.toDate();
      return start <= now && end >= now;
    });
  });
}


export async function fetchClassEvents() {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`);
  return response.data;
}

export async function fetchBubbleEvents() {
  const responce = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/bubble-events/`)
  return responce.data
}

export async function fetchGymEvents() {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/gym-events/`);
  return response.data;
}


export const dayMap: Record<string, string> = {
  'MON': 'MONDAY',
  'TUE': 'TUESDAY',
  'WED': 'WEDNESDAY',
  'THU': 'THURSDAY',
  'FRI': 'FRIDAY'
};








// Django Backend API Connections (from Bruno Collection)


// export async function fetchGymEvents() {
//   const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/gym-events/`);
//   return response.data;
// }
// export async function fetchBubbleEvents() {
//   const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/bubble-events/`);
//   return response.data;
// }
// export async function fetchMealTimes() {
//   const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/meal-times/`);
//   return response.data;
// }
// export async function fetchScheduleEntries(params?: { day?: string; course?: string; study_year?: string }) {
//   const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/schedule/`, { params });
//   return response.data;
// }
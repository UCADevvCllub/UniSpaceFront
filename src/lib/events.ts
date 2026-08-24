import axios from "axios";

// true once a token is expired (or close enough it'll die mid-request)
function isExpired(token: string): boolean {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    return Date.now() / 1000 > exp - 10;
  } catch {
    return true;
  }
}

// swaps the refresh token for a new access token; null if there's no refresh token or it's dead too
let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  const refresh = typeof window !== "undefined" ? localStorage.getItem("refresh") : null;
  if (!refresh) return null;
  try {
    const res = await axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/auth/jwt/refresh/`, { refresh });
    localStorage.setItem("access", res.data.access);
    return res.data.access;
  } catch {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    return null;
  }
}

// sends the saved JWT with every Django call, so admin writes actually authenticate.
// refreshes ahead of time if it's expired, instead of letting the request 401 first.
export const djangoApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_LOCAL });
djangoApi.interceptors.request.use(async (config) => {
  let token = typeof window !== "undefined" ? localStorage.getItem("access") : null;
  if (token && isExpired(token)) {
    refreshInFlight ??= refreshAccessToken().finally(() => { refreshInFlight = null; });
    token = await refreshInFlight;
  }
  if (token) config.headers.Authorization = `JWT ${token}`;
  return config;
});

// fallback for a 401 the expiry check couldn't predict (revoked token, clock skew, etc.)
djangoApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;
      refreshInFlight ??= refreshAccessToken().finally(() => { refreshInFlight = null; });
      const newToken = await refreshInFlight;
      if (newToken) {
        original.headers.Authorization = `JWT ${newToken}`;
        return djangoApi(original);
      }
    }
    return Promise.reject(error);
  },
);

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

export const CANTEEN_SCHEDULE = {
  breakfastWeekday: "8:00 AM - 9:30 AM",
  breakfastWeekend: "10:00 AM",
  lunch: "12:00 PM - 2:00 PM",
  dinner: "6:00 PM - 8:00 PM",
} as const;


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




// fetching bubble-event data from the endpoint

export async function fetchBubbleEvents() {
  const responce = await djangoApi.get(`/api/bubble-events/`)
  return responce.data
}

// fetching gym-event data from the endpoint

export async function fetchGymEvents() {
  const response = await djangoApi.get(`/api/gym-events/`);
  return response.data;
}


// my section


// options
export const fetchSubjects = () =>
  djangoApi.get(`/api/subject-entries/`).then(res => res.data);

export const fetchInstructors = () =>
  djangoApi.get(`/api/instructor-entries/`).then(res => res.data);

export const fetchRooms = () =>
  djangoApi.get(`/api/room-entries/`).then(res => res.data);

export const fetchCohorts = () =>
  djangoApi.get(`/api/cohort-entries/`).then(res => res.data);

export const fetchContacts = () =>
  djangoApi.get(`/api/contacts/`).then(res => res.data);

export async function fetchEvents() {
  const response = await djangoApi.get(`/api/class-events/`);
  return response.data;
}
// CREATE
export async function createClassEvent(data: any) {
  const payload = {
    subject_id: data.subjectId,
    instructor_id: data.instructorId,
    cohort_id: data.cohortId,
    room_id: data.roomId,
    event_data: {
      day: data.day,
      start_time: data.startTime,
      end_time: data.endTime,
      status: 'CLASS'
    }
  };
  const response = await djangoApi.post(`/api/class-events/`, payload);
  return response.data;
}

// ADD

export async function updateClassEvent(id: string, data: any) {
  const payload = {
    subject_id: parseInt(data.subject_id),
    instructor_id: parseInt(data.instructor_id),
    cohort_id: parseInt(data.cohort_id),
    room_id: parseInt(data.room_id),
    event_data: {
      day: data.day,
      start_time: data.start_time.length === 5 ? data.start_time + ":00" : data.start_time,
      end_time: data.end_time.length === 5 ? data.end_time + ":00" : data.end_time,
      status: "CLASS"
    }
  };

  return djangoApi.patch(`/api/class-events/${id}/`, payload);
}



// all the classevents
export async function fetchClassEvents() {
  const response = await djangoApi.get(`/api/class-events/`);
  return response.data;
}
// deleto
export async function deleteClassEvent(id: string) {

  const response = await djangoApi.delete(`/api/class-events/${id}/`);
  return response.data;
}


export const dayMap: Record<string, string> = {
  'MON': 'MONDAY',
  'TUE': 'TUESDAY',
  'WED': 'WEDNESDAY',
  'THU': 'THURSDAY',
  'FRI': 'FRIDAY'
};

export async function createGymEventDjango(data: {
  gender: string;
  event_data: { day: string; start_time: string; end_time: string };
}) {
  const response = await djangoApi.post(`/api/gym-events/`, data);
  return response.data;
}

export async function patchGymEventDjango(
  id: number | string,
  data: Partial<{ gender: string; event_data: Partial<{ day: string; start_time: string; end_time: string }> }>
) {
  const response = await djangoApi.patch(`/api/gym-events/${id}/`, data);
  return response.data;
}

export async function deleteGymEventDjango(id: number | string) {
  const response = await djangoApi.delete(`/api/gym-events/${id}/`);
  return response.data;
}

export async function createBubbleEventDjango(data: {
  name: string;
  event_data: { day: string; start_time: string; end_time: string };
}) {
  const response = await djangoApi.post(`/api/bubble-events/`, data);
  return response.data;
}

export async function patchBubbleEventDjango(
  id: number | string,
  data: Partial<{ name: string; event_data: Partial<{ day: string; start_time: string; end_time: string }> }>
) {
  const response = await djangoApi.patch(`/api/bubble-events/${id}/`, data);
  return response.data;
}

export async function deleteBubbleEventDjango(id: number | string) {
  const response = await djangoApi.delete(`/api/bubble-events/${id}/`);
  return response.data;
}







// Django Backend API Connections (from Bruno Collection)


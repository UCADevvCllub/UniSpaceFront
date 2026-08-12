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
  const responce = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/bubble-events/`)
  return responce.data
}

// fetching gym-event data from the endpoint

export async function fetchGymEvents() {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/gym-events/`);
  return response.data;
}


// my section


// options
export const fetchSubjects = () =>
  axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/subject-entries/`).then(res => res.data);

export const fetchInstructors = () =>
  axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/instructor-entries/`).then(res => res.data);

export const fetchRooms = () =>
  axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/room-entries/`).then(res => res.data);

export const fetchCohorts = () =>
  axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/cohort-entries/`).then(res => res.data);

export async function fetchEvents() {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`);
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
  const response = await axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`, payload);
  return response.data;
}

// ADD

export async function updateClassEvent(id: string, data: any) {
  console.log("API CALL STARTING - ID:", id); 
  

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

  console.log("PAYLOAD READY:", payload);


  const url = `${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/${id}/`;
  
  return axios.patch(url, payload);
}



// all the classevents
export async function fetchClassEvents() {
  const response = await axios.get(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`);
  return response.data;
}
// deleto
export async function deleteClassEvent(id: string) {

  const response = await axios.delete(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/${id}/`);
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
  const response = await axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/gym-events/`, data);
  return response.data;
}

export async function patchGymEventDjango(
  id: number | string,
  data: Partial<{ gender: string; event_data: Partial<{ day: string; start_time: string; end_time: string }> }>
) {
  const response = await axios.patch(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/gym-events/${id}/`, data);
  return response.data;
}

export async function deleteGymEventDjango(id: number | string) {
  const response = await axios.delete(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/gym-events/${id}/`);
  return response.data;
}

export async function createBubbleEventDjango(data: {
  name: string;
  event_data: { day: string; start_time: string; end_time: string };
}) {
  const response = await axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/bubble-events/`, data);
  return response.data;
}

export async function patchBubbleEventDjango(
  id: number | string,
  data: Partial<{ name: string; event_data: Partial<{ day: string; start_time: string; end_time: string }> }>
) {
  const response = await axios.patch(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/bubble-events/${id}/`, data);
  return response.data;
}

export async function deleteBubbleEventDjango(id: number | string) {
  const response = await axios.delete(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/bubble-events/${id}/`);
  return response.data;
}







// Django Backend API Connections (from Bruno Collection)


import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EventType } from "@/types/event";

interface ScheduleInput {
  title: string;
  type: Exclude<EventType, "booking">;
  location: string;
  group: string;
  start: Date;
  end: Date;
  description: string;
}

const eventsCollection = collection(db, "events");

export async function createScheduleEvent(input: ScheduleInput) {
  await addDoc(eventsCollection, {
    title: input.title,
    type: input.type,
    location: input.location,
    group: input.group,
    start: Timestamp.fromDate(input.start),
    end: Timestamp.fromDate(input.end),
    description: input.description,
    createdAt: Timestamp.now(),
  });
}

export async function updateScheduleEvent(eventId: string, input: ScheduleInput) {
  await updateDoc(doc(eventsCollection, eventId), {
    title: input.title,
    type: input.type,
    location: input.location,
    group: input.group,
    start: Timestamp.fromDate(input.start),
    end: Timestamp.fromDate(input.end),
    description: input.description,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteScheduleEvent(eventId: string) {
  await deleteDoc(doc(eventsCollection, eventId));
}

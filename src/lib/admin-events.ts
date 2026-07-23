import axios from "axios";
import { reverseDayMap } from "@/lib/utils";
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


export async function saveLessonToDjango(lesson: any) {
  const payload = {
    subject_id: lesson.subjectId, // You'll need the ID from your Subject table
    instructor_id: lesson.instructorId,
    cohort_id: lesson.cohortId,
    room_id: lesson.roomId,
    event_data: {
      day: reverseDayMap[lesson.day],
      start_time: `${lesson.startTime}:00`,
      end_time: `${lesson.endTime}:00`,
      status: 'CLASS'
    }
  };

  return axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`, payload);
}
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookingInput } from "@/types/event";

const eventsCollection = collection(db, "events");

export async function createBooking(input: BookingInput, userId?: string) {
  const start = Timestamp.fromDate(input.start);
  const end = Timestamp.fromDate(input.end);

  const conflictsQuery = query(
    eventsCollection,
    where("type", "==", "booking"),
    where("location", "==", input.location),
    where("start", "<", end)
  );

  const querySnapshot = await getDocs(conflictsQuery);
  const hasConflict = querySnapshot.docs.some((docSnap) => {
    const docData = docSnap.data();
    // We already filtered by start < end, now we just need to ensure doc.end > start
    return docData.end.toMillis() > start.toMillis();
  });

  if (hasConflict) {
    throw new Error("This slot is already booked.");
  }

  await addDoc(eventsCollection, {
    title: input.title,
    type: "booking",
    location: input.location,
    group: input.group,
    start,
    end,
    description: input.description,
    bookedBy: input.bookedBy || "",
    whatsapp: input.whatsapp || "",
    createdBy: userId || "anonymous",
    createdAt: Timestamp.now(),
  });
}

export async function updateBooking(eventId: string, input: BookingInput) {
  const start = Timestamp.fromDate(input.start);
  const end = Timestamp.fromDate(input.end);

  const conflictsQuery = query(
    eventsCollection,
    where("type", "==", "booking"),
    where("location", "==", input.location),
    where("start", "<", end)
  );

  const querySnapshot = await getDocs(conflictsQuery);
  const hasConflict = querySnapshot.docs.some((docSnap) => {
    if (docSnap.id === eventId) return false; // Ignore self
    const docData = docSnap.data();
    return docData.end.toMillis() > start.toMillis();
  });

  if (hasConflict) {
    throw new Error("This slot is already booked.");
  }

  await updateDoc(doc(eventsCollection, eventId), {
    title: input.title,
    location: input.location,
    group: input.group,
    start,
    end,
    description: input.description,
    bookedBy: input.bookedBy || "",
    whatsapp: input.whatsapp || "",
    updatedAt: Timestamp.now(),
  });
}

export async function quickCreateBooking(userId: string, input: BookingInput) {
  await addDoc(eventsCollection, {
    ...input,
    type: "booking",
    start: Timestamp.fromDate(input.start),
    end: Timestamp.fromDate(input.end),
    createdBy: userId,
    createdAt: Timestamp.now(),
  });
}

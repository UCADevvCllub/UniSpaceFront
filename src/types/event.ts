import { Timestamp } from "firebase/firestore";

export type EventType = "lesson" | "facility" | "booking" | "contact";

export interface CampusEvent {
  id: string;
  title: string;
  type: EventType;
  location: string;
  group: string;
  start: Timestamp;
  end: Timestamp;
  description: string;
  bookedBy?: string;
  whatsapp?: string;
}

export interface BookingInput {
  title: string;
  location: string;
  group: string;
  start: Date;
  end: Date;
  description: string;
  bookedBy?: string;
  whatsapp?: string;
}

import axios from "axios";
import { djangoApi } from "@/lib/events";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://web-production-4fa53e.up.railway.app";

export async function deleteScheduleEvent(eventId: string) {
  const response = await axios.delete(`${API_BASE_URL}/api/events/${eventId}/`);
  return response.data;
}

export async function createContact(input: {
  full_name: string;
  role: string;
  phone_number: string;
  location: string;
}) {
  const response = await djangoApi.post(`/api/contacts/`, input);
  return response.data;
}

export async function deleteContact(id: number | string) {
  const response = await djangoApi.delete(`/api/contacts/${id}/`);
  return response.data;
}

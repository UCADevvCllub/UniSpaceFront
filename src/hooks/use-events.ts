"use client";

import { useQuery } from "@tanstack/react-query";
import { getEvents } from "@/lib/events";
import { EventType } from "@/types/event";

export function useEvents(filters?: { type?: EventType; group?: string; location?: string }) {
  return useQuery({
    queryKey: ["events", filters],
    queryFn: () => getEvents(filters),
  });
}

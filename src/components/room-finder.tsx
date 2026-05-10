"use client";

import { useMemo } from "react";
import { useEvents } from "@/hooks/use-events";
import { findEmptyClassrooms } from "@/lib/events";
import { Card } from "@/components/ui/card";

export function RoomFinder() {
  const lessons = useEvents({ type: "lesson" });

  const emptyRooms = useMemo(
    () => findEmptyClassrooms(lessons.data ?? []),
    [lessons.data],
  );

  return (
    <Card>
      <h3 className="text-base font-semibold">Find Empty Room</h3>
      {emptyRooms.length ? (
        <p className="mt-2 text-sm text-slate-700">{emptyRooms.join(", ")}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">No currently empty classroom found.</p>
      )}
    </Card>
  );
}

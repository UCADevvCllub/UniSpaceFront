"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { pickCurrentOrNextEvent, CANTEEN_SCHEDULE } from "@/lib/events";
import { formatEventTime } from "@/lib/utils";
import { useEvents } from "@/hooks/use-events";
import { Card } from "@/components/ui/card";

export function HomeDashboard() {
  const { classYear, user } = useAuth();
  const lessons = useEvents(user ? { group: classYear } : undefined);
  const facilities = useEvents({ type: "facility" });

  const currentOrNext = useMemo(
    () => pickCurrentOrNextEvent(lessons.data ?? []),
    [lessons.data],
  );

  const gymEvent = (facilities.data ?? []).find((event) =>
    event.location.toLowerCase().includes("gym"),
  );

  return (
    <div className="space-y-4">
      {(lessons.isError || facilities.isError) && (
        <Card>
          <p className="text-sm text-rose-700">
            Failed to load events from Firestore. Check Rules publish status and query indexes.
          </p>
        </Card>
      )}

      <Card>
        <p className="text-xs uppercase text-slate-500">Right Now</p>
        {currentOrNext ? (
          <>
            <h2 className="mt-1 text-lg font-semibold">{currentOrNext.title}</h2>
            <p className="text-sm text-slate-600">
              {currentOrNext.location} | {formatEventTime(currentOrNext.start)} -{" "}
              {formatEventTime(currentOrNext.end)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No upcoming events for your year.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase text-slate-500">Canteen Schedule</p>
          <div className="mt-1 text-sm text-slate-700 space-y-0.5">
            <p><span className="font-semibold text-slate-900">Breakfast:</span> {CANTEEN_SCHEDULE.breakfastWeekday} (WD) / {CANTEEN_SCHEDULE.breakfastWeekend} (WE)</p>
            <p><span className="font-semibold text-slate-900">Lunch:</span> {CANTEEN_SCHEDULE.lunch}</p>
            <p><span className="font-semibold text-slate-900">Dinner:</span> {CANTEEN_SCHEDULE.dinner}</p>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Gym Status</p>
          <p className="mt-1 text-sm font-medium">
            {gymEvent ? `${gymEvent.title} (${gymEvent.description})` : "No status available."}
          </p>
        </Card>
      </div>
    </div>
  );
}

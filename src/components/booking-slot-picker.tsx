"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { createBooking } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function BookingSlotPicker() {
  const { user, classYear } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (!user) {
      setStatus("Please sign in first.");
      return;
    }

    if (!start || !end) {
      setStatus("Please select start and end time.");
      return;
    }

    try {
      await createBooking({
        title: "TV Lounge Slot",
        location: "TV Lounge",
        group: classYear,
        start: new Date(start),
        end: new Date(end),
        description: "Booked from campus app",
      }, user.id?.toString());
      setStatus("Booking confirmed.");
      setStart("");
      setEnd("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking failed.");
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">TV Lounge Slot Picker</h2>
      <label className="block text-sm text-slate-700">
        Start
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      <label className="block text-sm text-slate-700">
        End
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          type="datetime-local"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </label>
      <Button onClick={submit} className="w-full">
        Book Slot
      </Button>
      {status && <p className="text-sm text-slate-600">{status}</p>}
    </Card>
  );
}

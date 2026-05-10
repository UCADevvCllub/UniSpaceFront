"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useEvents } from "@/hooks/use-events";
import {
  createScheduleEvent,
  deleteScheduleEvent,
  updateScheduleEvent,
} from "@/lib/admin-events";
import { formatEventTime } from "@/lib/utils";
import { EventType } from "@/types/event";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FilterKey = "my-year" | "classrooms" | "facilities";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "my-year", label: "My Year" },
  { key: "classrooms", label: "Classrooms" },
  { key: "facilities", label: "Facilities" },
];

function mapFilterToType(filter: FilterKey): EventType | undefined {
  if (filter === "facilities") return "facility";
  if (filter === "classrooms") return "lesson";
  return undefined;
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function SmartFilter() {
  const { classYear, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("my-year");
  const [room, setRoom] = useState("Room 201");
  const [status, setStatus] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "lesson" as "lesson" | "facility",
    location: "",
    group: "",
    start: "",
    end: "",
    description: "",
  });

  const events = useEvents({
    group: filter === "my-year" ? classYear : undefined,
    type: mapFilterToType(filter),
    location: filter === "classrooms" ? room : undefined,
  });

  const sorted = useMemo(
    () =>
      (events.data ?? []).slice().sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    [events.data],
  );

  const resetForm = () => {
    setEditingEventId(null);
    setForm({
      title: "",
      type: "lesson",
      location: "",
      group: "",
      start: "",
      end: "",
      description: "",
    });
  };

  const submitEvent = async () => {
    if (!isAdmin) return;
    if (!form.title || !form.location || !form.group || !form.start || !form.end) {
      setStatus("Please fill all required fields.");
      return;
    }

    const startDate = new Date(form.start);
    const endDate = new Date(form.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setStatus("Please provide valid start and end date/time.");
      return;
    }
    if (endDate <= startDate) {
      setStatus("End time must be after start time.");
      return;
    }

    try {
      if (editingEventId) {
        await updateScheduleEvent(editingEventId, {
          title: form.title,
          type: form.type,
          location: form.location,
          group: form.group,
          start: startDate,
          end: endDate,
          description: form.description,
        });
        setStatus("Schedule updated.");
      } else {
        await createScheduleEvent({
          title: form.title,
          type: form.type,
          location: form.location,
          group: form.group,
          start: startDate,
          end: endDate,
          description: form.description,
        });
        setStatus("Schedule created.");
      }

      await queryClient.invalidateQueries({ queryKey: ["events"] });
      resetForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save schedule.");
    }
  };

  const startEditing = (event: (typeof sorted)[number]) => {
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      type: event.type === "facility" ? "facility" : "lesson",
      location: event.location,
      group: event.group,
      start: toDateTimeLocalValue(event.start.toDate()),
      end: toDateTimeLocalValue(event.end.toDate()),
      description: event.description,
    });
    setStatus("");
  };

  const removeEvent = async (eventId: string) => {
    if (!isAdmin) return;
    try {
      await deleteScheduleEvent(eventId);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      if (editingEventId === eventId) resetForm();
      setStatus("Schedule deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete schedule.");
    }
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">Admin: Manage Schedules</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Title
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              Type
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    type: event.target.value as "lesson" | "facility",
                  }))
                }
              >
                <option value="lesson">Lesson</option>
                <option value="facility">Facility</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Location
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.location}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            <label className="text-sm text-slate-700">
              Group
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.group}
                onChange={(event) => setForm((prev) => ({ ...prev, group: event.target.value }))}
                placeholder="Class of 2027, All, etc."
              />
            </label>
            <label className="text-sm text-slate-700">
              Start
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                type="datetime-local"
                value={form.start}
                onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-700">
              End
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                type="datetime-local"
                value={form.end}
                onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm text-slate-700">
            Description
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={submitEvent}>
              {editingEventId ? "Update Schedule" : "Create Schedule"}
            </Button>
            {editingEventId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
          </div>
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.key}
            variant={option.key === filter ? "default" : "outline"}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {filter === "classrooms" && (
        <input
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          placeholder="Search classroom, e.g. Room 201"
        />
      )}

      <div className="space-y-3">
        {sorted.map((event) => (
          <Card key={event.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">{event.title}</h3>
              {isAdmin && event.type !== "booking" && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => startEditing(event)}>
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => removeEvent(event.id)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {event.location} | {formatEventTime(event.start)} - {formatEventTime(event.end)}
            </p>
            <p className="mt-1 text-sm text-slate-700">{event.description}</p>
          </Card>
        ))}

        {!sorted.length && (
          <Card>
            <p className="text-sm text-slate-600">No events for this filter.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

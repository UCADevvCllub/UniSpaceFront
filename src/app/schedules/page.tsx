"use client";

import { useEffect, useMemo, useState } from "react";
import { Coffee, Sun, Moon } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useEvents } from "@/hooks/use-events";
import { createScheduleEvent, deleteScheduleEvent, updateScheduleEvent } from "@/lib/admin-events";
import { formatEventTime } from "@/lib/utils";
import {
  fetchGymEvents,
  fetchBubbleEvents,
  createGymEventDjango,
  patchGymEventDjango,
  deleteGymEventDjango,
  createBubbleEventDjango,
  patchBubbleEventDjango,
  deleteBubbleEventDjango,
  CANTEEN_SCHEDULE,
} from "@/lib/events";

export type GymSlot = {
  time: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
};

const scheduleTabs = ["Canteen", "Gym", "Bubble"] as const;
type ScheduleTab = (typeof scheduleTabs)[number];

function dateToInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const gymDayKeyMap: Record<string, keyof Omit<GymSlot, "time">> = {
  MON: "mon",
  TUE: "tue",
  WED: "wed",
  THU: "thu",
  FRI: "fri",
  SAT: "sat",
  SUN: "sun",
};

export default function SchedulesPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("Canteen");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEditingGym, setIsEditingGym] = useState(false);
  const [gymForm, setGymForm] = useState<GymSlot[]>([]);
  const [isEditingBubble, setIsEditingBubble] = useState(false);
  const [bubbleForm, setBubbleForm] = useState<GymSlot[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    title: "",
    group: "All",
    start: "",
    end: "",
    description: "",
  });



  const { data: djangoBubbleEvents, isLoading: isBubbleLoading } = useQuery({
    queryKey: ["django-bubble-events"],
    queryFn: fetchBubbleEvents,
  });

  // django bubble-event data to front end 

  const djangoBubbleSchedule = useMemo(() => {
    if (!Array.isArray(djangoBubbleEvents) || !djangoBubbleEvents.length) return [];

    const grouped = new Map<string, GymSlot>();

    for (const item of djangoBubbleEvents) {
      const eventObj = item.event || item;
      const rawDay = (eventObj.day || "").toUpperCase().trim();
      const slotKey = `${eventObj.start_time?.slice(0, 5) ?? "00:00"}-${eventObj.end_time?.slice(0, 5) ?? "00:00"}`;

      const dayKey = rawDay ? gymDayKeyMap[rawDay] || gymDayKeyMap[rawDay.slice(0, 3)] : undefined;

      if (!dayKey) continue;

      const existing = grouped.get(slotKey) ?? {
        time: slotKey,
        mon: "",
        tue: "",
        wed: "",
        thu: "",
        fri: "",
        sat: "",
        sun: "",
      };

      existing[dayKey] = item.name || item.title || "";
      grouped.set(slotKey, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [djangoBubbleEvents]);


  const { data: djangoGymEvents, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-gym-events"],
    queryFn: fetchGymEvents,
  });

  // django gym-event data to front end 

  const djangoGymSchedule = useMemo(() => {
    if (!Array.isArray(djangoGymEvents) || !djangoGymEvents.length) return [];

    const grouped = new Map<string, GymSlot>();

    for (const item of djangoGymEvents) {
      const eventObj = item.event || item;
      const rawDay = (eventObj.day || "").toUpperCase().trim();
      const slotKey = `${eventObj.start_time?.slice(0, 5) ?? "00:00"}-${eventObj.end_time?.slice(0, 5) ?? "00:00"}`;

      const dayKey = rawDay ? gymDayKeyMap[rawDay] || gymDayKeyMap[rawDay.slice(0, 3)] : undefined;

      if (!dayKey) continue;

      const existing = grouped.get(slotKey) ?? {
        time: slotKey,
        mon: "",
        tue: "",
        wed: "",
        thu: "",
        fri: "",
        sat: "",
        sun: "",
      };

      existing[dayKey] = item.gender ?? item.name ?? "";
      grouped.set(slotKey, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [djangoGymEvents]);

  const facilities = useEvents({ type: "facility" });


  const gymSchedule = djangoGymSchedule.length > 0 ? djangoGymSchedule : [];


  const bubbleSchedule = djangoBubbleSchedule.length > 0 ? djangoBubbleSchedule : [];

  const filteredEvents = useMemo(
    () =>
      (facilities.data ?? [])
        .filter((event) => event.location.toLowerCase() === activeTab.toLowerCase())
        .sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    [activeTab, facilities.data],
  );

  const resetForm = () => {
    setEditingEventId(null);
    setStatus("");
    setForm({ title: "", group: "All", start: "", end: "", description: "" });
    setIsEditingGym(false);
    setIsEditingBubble(false);
  };

  const startEdit = (event: (typeof filteredEvents)[number]) => {
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      group: event.group,
      start: dateToInput(event.start.toDate()),
      end: dateToInput(event.end.toDate()),
      description: event.description,
    });
  };

  const saveEvent = async () => {
    if (!isAdmin) return;
    if (!form.title || !form.start || !form.end) {
      setStatus("Title, start, and end are required.");
      return;
    }

    const start = new Date(form.start);
    const end = new Date(form.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setStatus("Please provide a valid time range.");
      return;
    }

    try {
      const input = {
        title: form.title,
        type: "facility" as const,
        location: activeTab,
        group: form.group || "All",
        start,
        end,
        description: form.description,
      };

      if (editingEventId) {
        await updateScheduleEvent(editingEventId, input);
        setStatus("Updated successfully.");
      } else {
        await createScheduleEvent(input);
        setStatus("Created successfully.");
      }

      await queryClient.invalidateQueries({ queryKey: ["events"] });
      resetForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save event.");
    }
  };

  const removeEvent = async (eventId: string) => {
    if (!isAdmin) return;
    await deleteScheduleEvent(eventId);
    await queryClient.invalidateQueries({ queryKey: ["events"] });
    if (editingEventId === eventId) resetForm();
  };

  useEffect(() => {
    setStatus("");
  }, [activeTab]);

  const dayKeyToDjangoDay: Record<string, string> = {
    mon: "MON",
    tue: "TUE",
    wed: "WED",
    thu: "THU",
    fri: "FRI",
    sat: "SAT",
    sun: "SUN",
  };

  // cuts the time to appropriate format e.g 10:00
  const padTime = (t: string) => {
    const parts = t.split(":");
    if (parts.length < 2) return t;
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  };

  const saveGymSchedule = async () => {
    if (!isAdmin) return;

    // aknowledges the existing in the db events
    try {
      const existingEventsMap = new Map<string, any>();
      for (const event of djangoGymEvents ?? []) {
        const day = event.event?.day?.toUpperCase();
        const startTime = padTime(event.event?.start_time?.slice(0, 5) ?? "");
        const endTime = padTime(event.event?.end_time?.slice(0, 5) ?? "");
        if (day && startTime && endTime) {
          const key = `${day}_${startTime}-${endTime}`;
          existingEventsMap.set(key, event);
        }
      }

      const handledEventIds = new Set<number | string>();
      const requests: Promise<any>[] = [];
      let patchedCount = 0;
      let createdCount = 0;
      let deletedCount = 0;
      // appropriate for POST, PATCH and DELETE formatting
      for (const slot of gymForm) {
        if (!slot.time || !slot.time.includes("-")) continue;
        const [startRaw, endRaw] = slot.time.split("-").map((t) => t.trim());
        const startPadded = padTime(startRaw);
        const endPadded = padTime(endRaw);
        const startTime = `${startPadded}:00`;
        const endTime = `${endPadded}:00`;

        for (const dayKey of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
          const genderVal = slot[dayKey]?.trim().toUpperCase();
          const day = dayKeyToDjangoDay[dayKey];
          const slotKey = `${day}_${startPadded}-${endPadded}`;
          const existingEvent = existingEventsMap.get(slotKey);

          if (existingEvent) {
            handledEventIds.add(existingEvent.id);
            // If event exists and gender value was changed patches
            if (genderVal) {
              if (existingEvent.gender?.toUpperCase().trim() !== genderVal) {
                patchedCount++;
                requests.push(
                  patchGymEventDjango(existingEvent.id, {
                    gender: genderVal,
                    event_data: {
                      day,
                      start_time: startTime,
                      end_time: endTime,
                    },
                  })
                );
              }
              // If event exists and its gender value does not exist anymore deletes
            } else {
              deletedCount++;
              requests.push(deleteGymEventDjango(existingEvent.id));
            }
            // If event does not exist POST
          } else if (genderVal) {
            createdCount++;
            requests.push(
              createGymEventDjango({
                gender: genderVal,
                event_data: {
                  day,
                  start_time: startTime,
                  end_time: endTime,
                },
              })
            );
          }
        }
      }
      // For deleting the whole schedule row 
      for (const event of djangoGymEvents ?? []) {
        if (event.id && !handledEventIds.has(event.id)) {
          const day = event.event?.day?.toUpperCase();
          const startTime = padTime(event.event?.start_time?.slice(0, 5) ?? "");
          const endTime = padTime(event.event?.end_time?.slice(0, 5) ?? "");
          const rowExists = gymForm.some((slot) => {
            if (!slot.time || !slot.time.includes("-")) return false;
            const [s, e] = slot.time.split("-").map((t) => padTime(t.trim()));
            return `${s}-${e}` === `${startTime}-${endTime}`;
          });
          if (!rowExists) {
            deletedCount++;
            requests.push(deleteGymEventDjango(event.id));
          }
        }
      }

      if (requests.length === 0) {
        setStatus("No changes detected in gym schedule.");
        setIsEditingGym(false);
        return;
      }

      await Promise.all(requests);

      await queryClient.invalidateQueries({ queryKey: ["django-gym-events"] });

      const details = [];
      if (patchedCount > 0) details.push(`${patchedCount} patched`);
      if (createdCount > 0) details.push(`${createdCount} created`);
      if (deletedCount > 0) details.push(`${deletedCount} deleted`);

      setStatus(`Gym schedule updated successfully (${details.join(", ")}).`);
      setIsEditingGym(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save gym schedule.");
    }
  };

  const saveBubbleSchedule = async () => {
    if (!isAdmin) return;
    try {
      const existingEventsMap = new Map<string, any>();
      for (const event of djangoBubbleEvents ?? []) {
        const day = event.event?.day?.toUpperCase();
        const startTime = padTime(event.event?.start_time?.slice(0, 5) ?? "");
        const endTime = padTime(event.event?.end_time?.slice(0, 5) ?? "");
        if (day && startTime && endTime) {
          const key = `${day}_${startTime}-${endTime}`;
          existingEventsMap.set(key, event);
        }
      }

      const handledEventIds = new Set<number | string>();
      const requests: Promise<any>[] = [];
      let patchedCount = 0;
      let createdCount = 0;
      let deletedCount = 0;

      for (const slot of bubbleForm) {
        if (!slot.time || !slot.time.includes("-")) continue;
        const [startRaw, endRaw] = slot.time.split("-").map((t) => t.trim());
        const startPadded = padTime(startRaw);
        const endPadded = padTime(endRaw);
        const startTime = `${startPadded}:00`;
        const endTime = `${endPadded}:00`;

        for (const dayKey of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
          const activityName = slot[dayKey]?.trim();
          const day = dayKeyToDjangoDay[dayKey];
          const slotKey = `${day}_${startPadded}-${endPadded}`;
          const existingEvent = existingEventsMap.get(slotKey);

          if (existingEvent) {
            handledEventIds.add(existingEvent.id);
            if (activityName) {
              if (existingEvent.name?.trim().toUpperCase() !== activityName.toUpperCase()) {
                patchedCount++;
                requests.push(
                  patchBubbleEventDjango(existingEvent.id, {
                    name: activityName,
                    event_data: {
                      day,
                      start_time: startTime,
                      end_time: endTime,
                    },
                  })
                );
              }
            } else {
              deletedCount++;
              requests.push(deleteBubbleEventDjango(existingEvent.id));
            }
          } else if (activityName) {
            createdCount++;
            requests.push(
              createBubbleEventDjango({
                name: activityName,
                event_data: {
                  day,
                  start_time: startTime,
                  end_time: endTime,
                },
              })
            );
          }
        }
      }

      for (const event of djangoBubbleEvents ?? []) {
        if (event.id && !handledEventIds.has(event.id)) {
          const day = event.event?.day?.toUpperCase();
          const startTime = padTime(event.event?.start_time?.slice(0, 5) ?? "");
          const endTime = padTime(event.event?.end_time?.slice(0, 5) ?? "");
          const rowExists = bubbleForm.some((slot) => {
            if (!slot.time || !slot.time.includes("-")) return false;
            const [s, e] = slot.time.split("-").map((t) => padTime(t.trim()));
            return `${s}-${e}` === `${startTime}-${endTime}`;
          });
          if (!rowExists) {
            deletedCount++;
            requests.push(deleteBubbleEventDjango(event.id));
          }
        }
      }

      if (requests.length === 0) {
        setStatus("No changes detected in bubble schedule.");
        setIsEditingBubble(false);
        return;
      }

      await Promise.all(requests);

      await queryClient.invalidateQueries({ queryKey: ["django-bubble-events"] });

      const details = [];
      if (patchedCount > 0) details.push(`${patchedCount} patched`);
      if (createdCount > 0) details.push(`${createdCount} created`);
      if (deletedCount > 0) details.push(`${deletedCount} deleted`);

      setStatus(`Bubble schedule updated successfully (${details.join(", ")}).`);
      setIsEditingBubble(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save bubble schedule.");
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Schedules</h1>

      <div className="flex flex-wrap gap-2">
        {scheduleTabs.map((tab) => (
          <Button key={tab} variant={tab === activeTab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
            {tab}
          </Button>
        ))}
      </div>

      {isAdmin && activeTab !== "Canteen" && activeTab !== "Gym" && activeTab !== "Bubble" && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">Admin Editor: {activeTab}</h2>
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
              Group
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={form.group}
                onChange={(event) => setForm((prev) => ({ ...prev, group: event.target.value }))}
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
              className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveEvent}>{editingEventId ? "Update" : "Create"}</Button>
            {editingEventId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeTab === "Canteen" && (
        <Card className="space-y-4 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-900">Canteen Schedule</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-orange-100/50 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-inner">
                  <Coffee className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-orange-950">Breakfast</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-900">
                  <span className="text-orange-700/80">Weekday:</span> {CANTEEN_SCHEDULE.breakfastWeekday}
                </p>
                <p className="text-sm font-medium text-orange-900">
                  <span className="text-orange-700/80">Weekend:</span> {CANTEEN_SCHEDULE.breakfastWeekend}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white shadow-inner">
                  <Sun className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-amber-950">Lunch</h3>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-amber-900">
                  {CANTEEN_SCHEDULE.lunch}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-white shadow-inner">
                  <Moon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-indigo-950">Dinner</h3>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-indigo-900">
                  {CANTEEN_SCHEDULE.dinner}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "Gym" && (
        <Card className="space-y-4 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6">
          {isDjangoLoading && <p className="text-sm text-slate-500">Loading gym endpoint data...</p>}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Gym Weekly Schedule</h2>
            {isAdmin && !isEditingGym && (
              <Button onClick={() => {
                setGymForm(gymSchedule);
                setIsEditingGym(true);
              }}>
                Edit Schedule
              </Button>
            )}
            {isAdmin && isEditingGym && (
              <div className="flex gap-2">
                <Button onClick={saveGymSchedule}>Save</Button>
                <Button variant="outline" onClick={() => setIsEditingGym(false)}>Cancel</Button>
                <Button variant="outline" onClick={() => setGymForm([...gymForm, { time: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" }])}>+ Row</Button>
              </div>
            )}
          </div>

          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[600px] sm:min-w-[800px] border-collapse text-xs sm:text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-200 p-1 sm:p-2 text-center font-bold text-slate-800 w-20 sm:w-32 sticky left-0 z-20">TIME</th>
                  {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((day) => (
                    <th key={day} className="border border-slate-300 bg-orange-200 p-1 sm:p-2 text-center font-bold text-slate-800">
                      <span className="sm:hidden">{day}</span>
                      <span className="hidden sm:inline">{{ MON: "MONDAY", TUE: "TUESDAY", WED: "WEDNESDAY", THU: "THURSDAY", FRI: "FRIDAY", SAT: "SATURDAY", SUN: "SUNDAY" }[day]}</span>
                    </th>
                  ))}
                  {isEditingGym && <th className="border border-slate-300 bg-slate-200 p-1 sm:p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {(isEditingGym ? gymForm : gymSchedule).map((slot, rowIndex) => {
                  const getBgColor = (val: string) => {
                    const v = val.toUpperCase().trim();
                    if (v === "FEMALE") return "bg-pink-500 text-white font-bold";
                    if (v === "MALE") return "bg-blue-600 text-white font-bold";
                    if (v === "CLEANING") return "bg-red-600 text-white font-bold";
                    if (v.includes("FACULTY") || v.includes("OPS")) return "bg-green-500 text-white font-bold";
                    return "bg-slate-100";
                  };

                  const updateCell = (col: keyof GymSlot, value: string) => {
                    const newForm = [...gymForm];
                    newForm[rowIndex] = { ...newForm[rowIndex], [col]: value };
                    setGymForm(newForm);
                  };

                  const removeRow = () => {
                    const newForm = [...gymForm];
                    newForm.splice(rowIndex, 1);
                    setGymForm(newForm);
                  };

                  return (
                    <tr key={rowIndex}>
                      <td className="border border-slate-300 bg-yellow-300 p-1 sm:p-2 text-center font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10">
                        {isEditingGym ? (
                          <input className="w-full px-1 text-center bg-white border border-slate-200" value={slot.time} onChange={(e) => updateCell("time", e.target.value)} />
                        ) : slot.time}
                      </td>
                      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                        const val = slot[day];
                        return (
                          <td key={day} className={`border border-slate-300 p-1 sm:p-2 text-center ${!isEditingGym ? getBgColor(val) : "bg-white"}`}>
                            {isEditingGym ? (
                              <input className="w-full px-1 text-center border border-slate-200 uppercase" value={val} onChange={(e) => updateCell(day, e.target.value)} />
                            ) : (
                              val.toUpperCase()
                            )}
                          </td>
                        )
                      })}
                      {isEditingGym && (
                        <td className="border border-slate-300 p-2 text-center bg-slate-50">
                          <Button variant="outline" onClick={removeRow} className="h-6 w-6 p-0 text-red-500">X</Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeTab === "Bubble" && (
        <Card className="space-y-4 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6">
          {isBubbleLoading && <p className="text-sm text-slate-500">Loading bubble endpoint data...</p>}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Bubble Weekly Schedule</h2>
            {isAdmin && !isEditingBubble && (
              <Button onClick={() => {
                setBubbleForm(bubbleSchedule);
                setIsEditingBubble(true);
              }}>
                Edit Schedule
              </Button>
            )}
            {isAdmin && isEditingBubble && (
              <div className="flex gap-2">
                <Button onClick={saveBubbleSchedule}>Save</Button>
                <Button variant="outline" onClick={() => setIsEditingBubble(false)}>Cancel</Button>
                <Button variant="outline" onClick={() => setBubbleForm([...bubbleForm, { time: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" }])}>+ Row</Button>
              </div>
            )}
          </div>

          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[600px] sm:min-w-[800px] border-collapse text-xs sm:text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-teal-300 p-1 sm:p-2 text-center font-bold text-slate-800 w-20 sm:w-32 sticky left-0 z-20">TIME</th>
                  {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((day) => (
                    <th key={day} className="border border-slate-300 bg-cyan-200 p-1 sm:p-2 text-center font-bold text-slate-800">
                      <span className="sm:hidden">{day}</span>
                      <span className="hidden sm:inline">{{ MON: "MONDAY", TUE: "TUESDAY", WED: "WEDNESDAY", THU: "THURSDAY", FRI: "FRIDAY", SAT: "SATURDAY", SUN: "SUNDAY" }[day]}</span>
                    </th>
                  ))}
                  {isEditingBubble && <th className="border border-slate-300 bg-slate-200 p-1 sm:p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {(isEditingBubble ? bubbleForm : bubbleSchedule).map((slot, rowIndex) => {
                  const getBubbleBgColor = (val: string) => {
                    const v = val.toUpperCase().trim();
                    if (v.includes("CLEANING")) return "bg-red-600 text-white font-bold";
                    if (v.includes("ALTAI")) return "bg-slate-300 text-slate-900 font-bold";
                    if (v === "TENNIS") return "bg-emerald-200 text-slate-900 font-bold";
                    if (v === "MCHS") return "bg-teal-500 text-white font-bold";
                    if (v === "FOOTBALL FEMALE") return "bg-pink-400 text-white font-bold";
                    if (v.includes("JUDO")) return "bg-slate-400 text-white font-bold";
                    if (v === "PE" || v.includes("PHYSICAL")) return "bg-yellow-400 text-slate-900 font-bold";
                    if (v === "BADMINTON") return "bg-indigo-400 text-white font-bold";
                    if (v === "CRICKET") return "bg-orange-300 text-slate-900 font-bold";
                    if (v.includes("SECURITY")) return "bg-green-500 text-white font-bold";
                    if (v === "VOLLEYBALL") return "bg-blue-600 text-white font-bold";
                    if (v === "UCA FACULTY") return "bg-orange-200 text-slate-900 font-bold";
                    if (v === "BASKETBALL") return "bg-purple-600 text-white font-bold";
                    if (v === "FOOTBALL") return "bg-green-300 text-slate-900 font-bold";
                    if (v.includes("MEP")) return "bg-amber-400 text-slate-900 font-bold";
                    return "bg-white";
                  };

                  const updateCell = (col: keyof GymSlot, value: string) => {
                    const newForm = [...bubbleForm];
                    newForm[rowIndex] = { ...newForm[rowIndex], [col]: value };
                    setBubbleForm(newForm);
                  };

                  const removeRow = () => {
                    const newForm = [...bubbleForm];
                    newForm.splice(rowIndex, 1);
                    setBubbleForm(newForm);
                  };

                  return (
                    <tr key={rowIndex}>
                      <td className="border border-slate-300 bg-teal-100 p-1 sm:p-2 text-center font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10">
                        {isEditingBubble ? (
                          <input className="w-full px-1 text-center bg-white border border-slate-200" value={slot.time} onChange={(e) => updateCell("time", e.target.value)} />
                        ) : slot.time}
                      </td>
                      {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                        const val = slot[day];
                        return (
                          <td key={day} className={`border border-slate-300 p-1 sm:p-2 text-center ${!isEditingBubble ? getBubbleBgColor(val) : "bg-white"}`}>
                            {isEditingBubble ? (
                              <input className="w-full px-1 text-center border border-slate-200 uppercase text-xs" value={val} onChange={(e) => updateCell(day, e.target.value)} />
                            ) : (
                              <span className="text-xs tracking-tight">{val.toUpperCase()}</span>
                            )}
                          </td>
                        )
                      })}
                      {isEditingBubble && (
                        <td className="border border-slate-300 p-2 text-center bg-slate-50">
                          <Button variant="outline" onClick={removeRow} className="h-6 w-6 p-0 text-red-500">X</Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeTab !== "Canteen" && activeTab !== "Gym" && activeTab !== "Bubble" && <div className="space-y-3">
        {filteredEvents.map((event) => (
          <Card key={event.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{event.title}</h3>
                <p className="text-sm text-slate-600">
                  {formatEventTime(event.start)} - {formatEventTime(event.end)} | {event.group}
                </p>
                <p className="mt-1 text-sm text-slate-700">{event.description}</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => startEdit(event)}>
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => removeEvent(event.id)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
        {!filteredEvents.length && (
          <Card>
            <p className="text-sm text-slate-600">No schedule entries in {activeTab} yet.</p>
          </Card>
        )}
      </div>}
    </section>
  );
}

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
import { fetchGymEvents } from "@/lib/events";
import { fetchBubbleEvents } from "@/lib/events"

const scheduleTabs = ["Canteen", "Gym", "Bubble"] as const;
type ScheduleTab = (typeof scheduleTabs)[number];

const defaultCanteenSchedule = {
  breakfastWeekday: "8:00 AM - 9:30 AM",
  breakfastWeekend: "10:00 AM",
  lunch: "12:00 PM - 2:00 PM",
  dinner: "6:00 PM - 8:00 PM",
};

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

const defaultBubbleSchedule: GymSlot[] = [
  { time: "10:00am - 11:00am", mon: "CLEANING & DISINFECTION", tue: "ALTAI-NARYN FOOTBALL SCHOOL", wed: "CLEANING & DISINFECTION", thu: "ALTAI-NARYN FOOTBALL SCHOOL", fri: "CLEANING & DISINFECTION", sat: "", sun: "" },
  { time: "11:00am - 12:00pm", mon: "CLEANING & DISINFECTION", tue: "ALTAI-NARYN FOOTBALL SCHOOL", wed: "CLEANING & DISINFECTION", thu: "ALTAI-NARYN FOOTBALL SCHOOL", fri: "CLEANING & DISINFECTION", sat: "TENNIS", sun: "TENNIS" },
  { time: "12:00pm - 1:00pm", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "TENNIS", sun: "TENNIS" },
  { time: "1:00pm - 2:00pm", mon: "MCHS", tue: "", wed: "MCHS", thu: "", fri: "", sat: "", sun: "" },
  { time: "2:00pm - 3:00pm", mon: "MCHS", tue: "ALTAI-NARYN FOOTBALL SCHOOL", wed: "MCHS", thu: "ALTAI-NARYN FOOTBALL SCHOOL", fri: "FOOTBALL FEMALE", sat: "JUDO GRAPPLING", sun: "JUDO GRAPPLING" },
  { time: "3:00pm - 4:00pm", mon: "", tue: "ALTAI-NARYN FOOTBALL SCHOOL", wed: "", thu: "ALTAI-NARYN FOOTBALL SCHOOL", fri: "FOOTBALL FEMALE", sat: "JUDO GRAPPLING", sun: "JUDO GRAPPLING" },
  { time: "4:00pm - 5:00pm", mon: "", tue: "PHYSICAL EDUCATION", wed: "", thu: "PHYSICAL EDUCATION", fri: "PHYSICAL EDUCATION", sat: "CRICKET", sun: "FOOTBALL FEMALE" },
  { time: "5:00pm - 6:00pm", mon: "PHYSICAL EDUCATION", tue: "PHYSICAL EDUCATION", wed: "JUDO GRAPPLING", thu: "PHYSICAL EDUCATION", fri: "PHYSICAL EDUCATION", sat: "CRICKET", sun: "FOOTBALL FEMALE" },
  { time: "6:00pm - 7:00pm", mon: "UCA SECURITY", tue: "PHYSICAL EDUCATION", wed: "JUDO GRAPPLING", thu: "PHYSICAL EDUCATION", fri: "PHYSICAL EDUCATION", sat: "VOLLEYBALL", sun: "FOOTBALL" },
  { time: "7:00pm - 8:00pm", mon: "UCA SECURITY", tue: "VOLLEYBALL", wed: "UCA FACULTY", thu: "BASKETBALL", fri: "UCA SECURITY", sat: "VOLLEYBALL", sun: "FOOTBALL" },
  { time: "8:00pm - 9:00pm", mon: "UCA SECURITY", tue: "VOLLEYBALL", wed: "UCA FACULTY", thu: "BASKETBALL", fri: "UCA SECURITY", sat: "VOLLEYBALL", sun: "FOOTBALL" },
  { time: "9:00pm - 10:00pm", mon: "CRICKET", tue: "BASKETBALL", wed: "FOOTBALL", thu: "VOLLEYBALL", fri: "FOOTBALL", sat: "BASKETBALL", sun: "MEP&KITCHEN" },
  { time: "10:00pm - 11:30pm", mon: "CRICKET", tue: "BASKETBALL", wed: "FOOTBALL", thu: "VOLLEYBALL", fri: "FOOTBALL", sat: "BASKETBALL", sun: "MEP&KITCHEN" },
];

function parseBubbleSchedule(description?: string): GymSlot[] {
  if (!description) return defaultBubbleSchedule;
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore
  }
  return defaultBubbleSchedule;
}

function serializeCanteenSchedule(schedule: typeof defaultCanteenSchedule) {
  return [
    `BreakfastWeekday=${schedule.breakfastWeekday}`,
    `BreakfastWeekend=${schedule.breakfastWeekend}`,
    `Lunch=${schedule.lunch}`,
    `Dinner=${schedule.dinner}`,
  ].join("\n");
}

function parseCanteenSchedule(description?: string) {
  if (!description) return defaultCanteenSchedule;

  const map = new Map<string, string>();
  for (const line of description.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (!key || !rest.length) continue;
    map.set(key.trim(), rest.join("=").trim());
  }

  return {
    breakfastWeekday: map.get("BreakfastWeekday") || defaultCanteenSchedule.breakfastWeekday,
    breakfastWeekend: map.get("BreakfastWeekend") || defaultCanteenSchedule.breakfastWeekend,
    lunch: map.get("Lunch") || defaultCanteenSchedule.lunch,
    dinner: map.get("Dinner") || defaultCanteenSchedule.dinner,
  };
}

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
  console.log("Current API URL:", process.env.NEXT_PUBLIC_API_LOCAL);
  let { isAdmin } = useAuth();
  isAdmin= true;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("Canteen");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEditingCanteen, setIsEditingCanteen] = useState(false);
  const [canteenForm, setCanteenForm] = useState(defaultCanteenSchedule);
  const [isEditingGym, setIsEditingGym] = useState(false);
  const [gymForm, setGymForm] = useState<GymSlot[]>([]);
  const [isEditingBubble, setIsEditingBubble] = useState(false);
  const [bubbleForm, setBubbleForm] = useState<GymSlot[]>(defaultBubbleSchedule);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    title: "",
    group: "All",
    start: "",
    end: "",
    description: "",
  });

  // fetching bubble-event data from the endpoint

  const { data: djangoBubbleEvents, isLoading: isBubbleLoading } = useQuery({
    queryKey: ["django-bubble-events"],
    queryFn: fetchBubbleEvents,
  });

  // django bubble-event data to front end 

  const djangoBubbleSchedule = useMemo(() => {
    if (!djangoBubbleEvents?.length) return [];

    const grouped = new Map<string, GymSlot>();

    // determines the displays of the timeslot, day of the week

    for (const event of djangoBubbleEvents) {
      const day = event.event?.day?.toUpperCase();
      const slotKey = `${event.event?.start_time?.slice(0, 5) ?? "00:00"}-${event.event?.end_time?.slice(0, 5) ?? "00:00"}`;
      const dayKey = day ? gymDayKeyMap[day] : undefined;

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

      // determinces the displays of the inside of the grid slot e.g (FOOTBALL, VOLLEYBALL)

      existing[dayKey] = event.name ?? "";
      grouped.set(slotKey, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [djangoBubbleEvents]);

 // fetching gym-events data from the endpoint

  const { data: djangoGymEvents, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-gym-events"],
    queryFn: fetchGymEvents,
  });

  // django gym-event data to front end 

  const djangoGymSchedule = useMemo(() => {
    if (!djangoGymEvents?.length) return [];

    const grouped = new Map<string, GymSlot>();

    for (const event of djangoGymEvents) {

      const day = event.event?.day?.toUpperCase();
      const slotKey = `${event.event?.start_time?.slice(0, 5) ?? "00:00"}-${event.event?.end_time?.slice(0, 5) ?? "00:00"}`;
      const dayKey = day ? gymDayKeyMap[day] : undefined;
    

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

      existing[dayKey] = event.gender ?? "";
      grouped.set(slotKey, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [djangoGymEvents]);

  const facilities = useEvents({ type: "facility" });
  const canteenEvents = useMemo(
    () =>
      (facilities.data ?? [])
        .filter((event) => event.location.toLowerCase() === "canteen")
        .sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    [facilities.data],
  );
  const canteenPrimaryEvent = canteenEvents[0] ?? null;
  const canteenSchedule = parseCanteenSchedule(canteenPrimaryEvent?.description);
  
  const gymEvents = useMemo(
    () =>
      (facilities.data ?? [])
        .filter((event) => event.location.toLowerCase() === "gym")
        .sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    [facilities.data],
  );
  const gymPrimaryEvent = gymEvents[0] ?? null;
  const gymSchedule = djangoGymSchedule.length > 0 ? djangoGymSchedule : [];

  const bubbleEvents = useMemo(
    () =>
      (facilities.data ?? [])
        .filter((event) => event.location.toLowerCase() === "bubble")
        .sort((a, b) => a.start.toMillis() - b.start.toMillis()),
    [facilities.data],
  );
  const bubblePrimaryEvent = bubbleEvents[0] ?? null;
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
    setIsEditingCanteen(false);
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
    if (activeTab !== "Canteen") setStatus("");
  }, [activeTab]);

  const saveCanteenSchedule = async () => {
    if (!isAdmin) return;
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      const description = serializeCanteenSchedule(canteenForm);

      if (canteenPrimaryEvent) {
        await updateScheduleEvent(canteenPrimaryEvent.id, {
          title: "Canteen Schedule",
          type: "facility",
          location: "Canteen",
          group: "All",
          start,
          end,
          description,
        });
      } else {
        await createScheduleEvent({
          title: "Canteen Schedule",
          type: "facility",
          location: "Canteen",
          group: "All",
          start,
          end,
          description,
        });
      }

      const duplicateEvents = canteenEvents.slice(1);
      await Promise.all(duplicateEvents.map((event) => deleteScheduleEvent(event.id)));
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("Canteen schedule updated successfully.");
      setIsEditingCanteen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save canteen schedule.");
    }
  };

  const saveGymSchedule = async () => {
    if (!isAdmin) return;
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      const description = JSON.stringify(gymForm);

      if (gymPrimaryEvent) {
        await updateScheduleEvent(gymPrimaryEvent.id, {
          title: "Gym Schedule",
          type: "facility",
          location: "Gym",
          group: "All",
          start,
          end,
          description,
        });
      } else {
        await createScheduleEvent({
          title: "Gym Schedule",
          type: "facility",
          location: "Gym",
          group: "All",
          start,
          end,
          description,
        });
      }

      const duplicateEvents = gymEvents.slice(1);
      await Promise.all(duplicateEvents.map((event) => deleteScheduleEvent(event.id)));
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("Gym schedule updated successfully.");
      setIsEditingGym(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save gym schedule.");
    }
  };

  const saveBubbleSchedule = async () => {
    if (!isAdmin) return;
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      const description = JSON.stringify(bubbleForm);

      if (bubblePrimaryEvent) {
        await updateScheduleEvent(bubblePrimaryEvent.id, {
          title: "Bubble Schedule",
          type: "facility",
          location: "Bubble",
          group: "All",
          start,
          end,
          description,
        });
      } else {
        await createScheduleEvent({
          title: "Bubble Schedule",
          type: "facility",
          location: "Bubble",
          group: "All",
          start,
          end,
          description,
        });
      }

      const duplicateEvents = bubbleEvents.slice(1);
      await Promise.all(duplicateEvents.map((event) => deleteScheduleEvent(event.id)));
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("Bubble schedule updated successfully.");
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
          
          {isEditingCanteen ? (
            <div className="space-y-3">
              <label className="block text-sm text-slate-700">
                Breakfast (Weekday)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={canteenForm.breakfastWeekday}
                  onChange={(event) => setCanteenForm((prev) => ({ ...prev, breakfastWeekday: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-700">
                Breakfast (Weekend)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={canteenForm.breakfastWeekend}
                  onChange={(event) => setCanteenForm((prev) => ({ ...prev, breakfastWeekend: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-700">
                Lunch
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={canteenForm.lunch}
                  onChange={(event) => setCanteenForm((prev) => ({ ...prev, lunch: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-700">
                Dinner
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={canteenForm.dinner}
                  onChange={(event) => setCanteenForm((prev) => ({ ...prev, dinner: event.target.value }))}
                />
              </label>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveCanteenSchedule}>Save</Button>
                <Button variant="outline" onClick={() => setIsEditingCanteen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
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
                      <span className="text-orange-700/80">Weekday:</span> {canteenSchedule.breakfastWeekday}
                    </p>
                    <p className="text-sm font-medium text-orange-900">
                      <span className="text-orange-700/80">Weekend:</span> {canteenSchedule.breakfastWeekend}
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
                      {canteenSchedule.lunch}
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
                      {canteenSchedule.dinner}
                    </p>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={() => {
                  setCanteenForm(canteenSchedule);
                  setIsEditingCanteen(true);
                }}>
                  Edit Canteen Schedule
                </Button>
              )}
            </>
          )}
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeTab === "Gym" && (
        <Card className="space-y-4 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6 overflow-x-auto">
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

          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-200 p-2 text-center font-bold text-slate-800 w-32 sticky left-0 z-20">TIME</th>
                {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((day) => (
                  <th key={day} className="border border-slate-300 bg-orange-200 p-2 text-center font-bold text-slate-800">{day}</th>
                ))}
                {isEditingGym && <th className="border border-slate-300 bg-slate-200 p-2"></th>}
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
                    <td className="border border-slate-300 bg-yellow-300 p-2 text-center font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10">
                      {isEditingGym ? (
                        <input className="w-full px-1 text-center bg-white border border-slate-200" value={slot.time} onChange={(e) => updateCell("time", e.target.value)} />
                      ) : slot.time}
                    </td>
                    {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                      const val = slot[day];
                      return (
                        <td key={day} className={`border border-slate-300 p-2 text-center ${!isEditingGym ? getBgColor(val) : "bg-white"}`}>
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
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeTab === "Bubble" && (
        <Card className="space-y-4 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-6 overflow-x-auto">
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

          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-teal-300 p-2 text-center font-bold text-slate-800 w-32 sticky left-0 z-20">TIME</th>
                {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((day) => (
                  <th key={day} className="border border-slate-300 bg-cyan-200 p-2 text-center font-bold text-slate-800">{day}</th>
                ))}
                {isEditingBubble && <th className="border border-slate-300 bg-slate-200 p-2"></th>}
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
                  if (v.includes("PHYSICAL")) return "bg-yellow-400 text-slate-900 font-bold";
                  if (v === "CRICKET") return "bg-orange-300 text-slate-900 font-bold";
                  if (v === "UCA SECURITY") return "bg-green-500 text-white font-bold";
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
                    <td className="border border-slate-300 bg-teal-100 p-2 text-center font-bold text-slate-900 whitespace-nowrap sticky left-0 z-10">
                      {isEditingBubble ? (
                        <input className="w-full px-1 text-center bg-white border border-slate-200" value={slot.time} onChange={(e) => updateCell("time", e.target.value)} />
                      ) : slot.time}
                    </td>
                    {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
                      const val = slot[day];
                      return (
                        <td key={day} className={`border border-slate-300 p-2 text-center ${!isEditingBubble ? getBubbleBgColor(val) : "bg-white"}`}>
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

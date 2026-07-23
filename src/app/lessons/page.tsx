"use client";

import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useEvents } from "@/hooks/use-events";
import { createScheduleEvent, updateScheduleEvent } from "@/lib/admin-events";
import { formatEventTime, mapDjangoToUi } from "@/lib/utils"; // Ensure mapDjangoToUi is exported in utils.ts
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { finalExamsSchedule } from "./final-exams-data";
import { fetchClassEvents } from "@/lib/events";




const groups = ["Final Exams", "Preparatory", "Freshman", "Sophomore", "Junior", "Senior"] as const;
type GroupLabel = (typeof groups)[number];

export type FreshmanLesson = {
  id: string;
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
  cohort: "Cohort 1" | "Cohort 2" | "Both";
  startTime: string; 
  endTime: string;   
  title: string;
  instructor: string;
  room: string;
};



const defaultFreshmanSchedule: FreshmanLesson[] = [
  { id: "m1", day: "MONDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Audiences for Communications", instructor: "Soheil Ashrafi", room: "203" },

];


function parseFreshmanSchedule(description?: string): FreshmanLesson[] {
  if (!description) return defaultFreshmanSchedule;
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { }
  return defaultFreshmanSchedule;
}

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const CALENDAR_START = 8 * 60;
const CALENDAR_END = 19 * 60;
const CALENDAR_DURATION = CALENDAR_END - CALENDAR_START;

export default function LessonsPage() {
  console.log("Current API URL:", process.env.NEXT_PUBLIC_API_LOCAL);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<GroupLabel>("Final Exams");
  const [status, setStatus] = useState("");
  const [isEditingFreshman, setIsEditingFreshman] = useState(false);
  const [freshmanForm, setFreshmanForm] = useState<FreshmanLesson[]>(defaultFreshmanSchedule);

  const lessons = useEvents({ type: "lesson", group: activeGroup });
  const freshmanEvents = useEvents({ type: "lesson", group: "Freshman_Template" });
  

  const { data: djangoClassEvents, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-class-events"],
    queryFn: fetchClassEvents,
  });


  const freshmanPrimaryEvent = (freshmanEvents.data ?? [])[0] ?? null;
  const djangoLessons = djangoClassEvents ? mapDjangoToUi(djangoClassEvents) : [];

  const freshmanSchedule = djangoLessons.length > 0 
    ? djangoLessons 
    : parseFreshmanSchedule(freshmanPrimaryEvent?.description);

  const sortedLessons = (lessons.data ?? []).slice().sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const saveFreshmanSchedule = async () => {
    if (!isAdmin) return;
    try {
      const description = JSON.stringify(freshmanForm);

      if (freshmanPrimaryEvent) {
        await updateScheduleEvent(freshmanPrimaryEvent.id, {
          title: "Freshman Template", type: "lesson", location: "Template", group: "Freshman_Template",
          start: new Date(), end: new Date(), description,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("Updated successfully.");
      setIsEditingFreshman(false);
    } catch (error) {
      setStatus("Failed to save.");
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Lessons</h1>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={group === activeGroup ? "rounded-full bg-primary px-4 py-2 text-sm text-white" : "rounded-full border border-slate-300 px-4 py-2 text-sm"}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Final Exams View */}
      {activeGroup === "Final Exams" && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Final Exams Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">

               <thead><tr className="bg-slate-100"><th>Cohort</th><th>Monday</th>{/*...*/}</tr></thead>
               <tbody>
                {finalExamsSchedule.map(row => (
                  <tr key={row.cohort} className="border-b">
                    <td className="p-2 font-bold">{row.cohort}</td>

                  </tr>
                ))}
               </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Freshman View */}
      {activeGroup === "Freshman" && (
        <Card className="p-6 bg-slate-50/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Freshman Weekly Schedule</h2>
            {isAdmin && (
              <Button onClick={() => { setFreshmanForm(freshmanSchedule); setIsEditingFreshman(!isEditingFreshman); }}>
                {isEditingFreshman ? "Cancel" : "Edit"}
              </Button>
            )}
          </div>room

          {isEditingFreshman ? (
            <div className="space-y-3">
              {freshmanForm.map((lesson, idx) => (
                <div key={lesson.id} className="flex gap-2 bg-white p-2 border rounded">

                  <span className="text-xs">{lesson.title}</span>
                </div>
              ))}
              <Button onClick={saveFreshmanSchedule}>Save All Changes</Button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">

               <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] relative h-[800px]">

                  {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => (
                    <div key={day} className="border-r relative">
                      {freshmanSchedule.filter(l => l.day === day).map(lesson => (
                         <div key={lesson.id} className="absolute w-full border bg-blue-50 p-1 text-[10px]" style={{
                           top: `${((timeToMinutes(lesson.startTime) - CALENDAR_START) / CALENDAR_DURATION) * 100}%`,
                           height: `${((timeToMinutes(lesson.endTime) - timeToMinutes(lesson.startTime)) / CALENDAR_DURATION) * 100}%`
                         }}>
                           {lesson.title}
                         </div>
                      ))}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </Card>
      )}


      {activeGroup !== "Freshman" && activeGroup !== "Final Exams" && (
        <div className="space-y-3">
          {sortedLessons.map((lesson) => (
            <Card key={lesson.id} className="p-4">
              <h3 className="font-bold">{lesson.title}</h3>
              <p className="text-sm">{lesson.description}</p>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}


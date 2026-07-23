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
  <Card className="space-y-4 border-slate-200 bg-slate-50/50 p-6">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold text-slate-900">Freshman Weekly Schedule</h2>
      {isAdmin && (
        <div className="flex gap-2">
          <Button 
            variant={isEditingFreshman ? "outline" : "default"}
            onClick={() => {
              setFreshmanForm(freshmanSchedule);
              setIsEditingFreshman(!isEditingFreshman);
            }}
          >
            {isEditingFreshman ? "Cancel" : "Edit Schedule"}
          </Button>
          {isEditingFreshman && <Button onClick={saveFreshmanSchedule}>Save All</Button>}
        </div>
      )}
    </div>

    {isEditingFreshman ? (
      <div className="space-y-3">
        {freshmanForm.map((lesson, idx) => (
          <div key={lesson.id} className="flex items-center gap-2 bg-white p-3 rounded-xl border shadow-sm">
             <span className="font-bold text-sm w-20">{lesson.day}</span>
             <span className="flex-1">{lesson.title}</span>
             <span className="text-slate-500 text-xs">{lesson.startTime} - {lesson.endTime}</span>
          </div>
        ))}
      </div>
    ) : (
      /* --- GOOGLE CALENDAR STYLE GRID --- */
      <div className="overflow-x-auto border border-slate-200 bg-white rounded-2xl shadow-sm">
        <div className="min-w-[1000px]">
          
          {/* 1. Header: Days of the Week */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] border-b border-slate-200 bg-slate-50/80">
            <div className="p-4 border-r border-slate-200 font-semibold text-slate-400 text-[10px] flex items-center justify-center sticky left-0 z-20 bg-slate-50">
              GMT+5
            </div>
            {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => (
              <div key={day} className="p-3 border-r last:border-r-0 border-slate-200 text-center">
                <div className="font-bold text-slate-700 text-sm tracking-wide">{day}</div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-400 mt-1 uppercase">
                  <div>Cohort 1</div>
                  <div>Cohort 2</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* 2. Calendar Body */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] relative h-[850px] bg-white">
            
            {/* Vertical Time Axis */}
            <div className="border-r border-slate-200 relative bg-slate-50/50 sticky left-0 z-20">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-full text-[10px] text-slate-400 font-medium pr-2 text-right" 
                  style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%`, transform: 'translateY(-50%)' }}
                >
                  {String(8 + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => {
              const dayLessons = freshmanSchedule.filter(l => l.day === day);
              return (
                <div key={day} className="border-r last:border-r-0 border-slate-100 relative">
                  {/* Horizontal Hour Lines (Background) */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute w-full border-t border-slate-100" 
                      style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }} 
                    />
                  ))}

                  {/* Lessons Mapped from Django */}
                  {dayLessons.map(lesson => {
                    const startMins = timeToMinutes(lesson.startTime);
                    const endMins = timeToMinutes(lesson.endTime);
                    const topPct = ((startMins - CALENDAR_START) / CALENDAR_DURATION) * 100;
                    const heightPct = ((endMins - startMins) / CALENDAR_DURATION) * 100;

                    // Split logic for Cohorts
                    const isC1 = lesson.cohort === "Cohort 1";
                    const isC2 = lesson.cohort === "Cohort 2";
                    const isBoth = lesson.cohort === "Both";

                    const left = isC2 ? "50%" : "0%";
                    const width = isBoth ? "100%" : "50%";
                    
                    // Google-style colors
                    const colorClass = isBoth 
                      ? "bg-white border-slate-300 text-slate-800 shadow-sm" 
                      : isC1 
                        ? "bg-indigo-50 border-l-indigo-500 text-indigo-700" 
                        : "bg-emerald-50 border-l-emerald-500 text-emerald-700";

                    return (
                      <div 
                        key={lesson.id} 
                        className={`absolute p-2 rounded-md border-l-4 border shadow-sm overflow-hidden transition-all hover:scale-[1.02] hover:z-30 ${colorClass}`}
                        style={{ top: `${topPct}%`, height: `${heightPct}%`, left, width, zIndex: 10 }}
                      >
                        <div className="text-[10px] font-bold leading-tight line-clamp-2">{lesson.title}</div>
                        <div className="text-[9px] opacity-80 mt-1 font-medium">
                          {lesson.startTime} - {lesson.endTime}
                        </div>
                        <div className="text-[9px] font-bold mt-1 truncate uppercase">
                          {lesson.room || "No Room"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
    {status && <p className="text-xs text-center text-slate-500">{status}</p>}
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


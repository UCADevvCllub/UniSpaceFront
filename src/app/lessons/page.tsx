"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchClassEvents } from "@/lib/events";
import { mapDjangoToUi, formatEventTime } from "@/lib/utils";
import { finalExamsSchedule } from "./final-exams-data";
import { useEvents } from "@/hooks/use-events";

// --- CONSTANTS ---
const groups = ["Freshman", "Sophomore", "Junior", "Senior"] as const;
type GroupLabel = (typeof groups)[number];

const CALENDAR_START = 8 * 60;
const CALENDAR_DURATION = (19 * 60) - CALENDAR_START;

const timeToMinutes = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};


const academicYearToId: Record<string, number> = {
  "Freshman": 1,
  "Sophomore": 2,
  "Junior": 3,
  "Senior": 4
};

export default function LessonsPage() {
  const [activeGroup, setActiveGroup] = useState<GroupLabel>("Freshman");

  // 1. Fetch from Django
  const { data: djangoData, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-class-events"],
    queryFn: fetchClassEvents,
  });


  const firebaseLessons = useEvents({ type: "lesson", group: activeGroup });

  const filteredSchedule = useMemo(() => {
    if (!djangoData) return [];
    const mapped = mapDjangoToUi(djangoData);
    const targetId = academicYearToId[activeGroup];
    
    // Debug log console
    const result = mapped.filter(item => item.yearId === targetId);
    console.log(`Filtering for ${activeGroup} (ID: ${targetId}). Found:`, result.length);
    return result;
  }, [djangoData, activeGroup]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Lessons</h1>

      {/* --- NAVBAR --- */}
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={group === activeGroup 
              ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-md" 
              : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"}
          >
            {group}
          </button>
        ))}
      </div>


      
      {/* --- VIEW 3: ACADEMIC YEARS (GOOGLE GRID) --- */}
      {academicYearToId[activeGroup] && (
        <Card className="p-6 border-slate-200 bg-slate-50/50">
          <h2 className="text-xl font-bold mb-4">{activeGroup} Schedule</h2>
          
          <div className="overflow-x-auto border border-slate-200 bg-white rounded-2xl shadow-sm">
            <div className="min-w-[1000px]">
              {/* Header Days */}
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] border-b border-slate-200 bg-slate-50/80">
                <div className="p-4 border-r border-slate-200 font-bold text-slate-400 text-[10px] flex items-center justify-center sticky left-0 z-20 bg-slate-50">TIME</div>
                {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => (
                  <div key={day} className="p-3 border-r border-slate-200 text-center last:border-r-0">
                    <div className="font-bold text-slate-700">{day}</div>
                    <div className="grid grid-cols-2 text-[9px] font-bold text-slate-400 mt-1">
                      <div>CS / Arts</div><div>CM / Science</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] relative h-[800px] bg-white">
                {/* Time Axis */}
                <div className="border-r border-slate-200 bg-slate-50/30 sticky left-0 z-20">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="absolute w-full text-[11px] text-slate-400 font-bold pr-3 text-right" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%`, transform: 'translateY(-50%)' }}>
                      {String(8 + i).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => (
                  <div key={day} className="border-r border-slate-100 relative last:border-r-0">
                    {/* Hour Lines */}
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="absolute w-full border-t border-slate-100" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }} />
                    ))}

                    {/* Lessons */}
                    {filteredSchedule.filter(l => l.day === day).map(lesson => {
                      const startMins = timeToMinutes(lesson.startTime);
                      const endMins = timeToMinutes(lesson.endTime);
                      const top = ((startMins - CALENDAR_START) / CALENDAR_DURATION) * 100;
                      const height = ((endMins - startMins) / CALENDAR_DURATION) * 100;
                      const left = lesson.cohortColumn === 'Cohort 2' ? '50%' : '0%';

                      return (
                        <div key={lesson.id} className="absolute p-2 rounded border-l-4 shadow-sm bg-indigo-50 border-indigo-200 border-l-indigo-500 text-indigo-700 z-10" style={{ top: `${top}%`, height: `${height}%`, left, width: '50%' }}>
                          <div className="text-[10px] font-bold truncate">{lesson.title}</div>
                          <div className="text-[9px] font-medium">{lesson.startTime}-{lesson.endTime}</div>
                          <div className="text-[9px] font-bold mt-1 uppercase text-indigo-900">{lesson.room}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {filteredSchedule.length === 0 && !isDjangoLoading && (
            <p className="text-center text-slate-500 mt-4">No classes found in Django for this year.</p>
          )}
        </Card>
      )}
    </section>
  );
}
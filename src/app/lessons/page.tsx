"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useEvents } from "@/hooks/use-events";
import { createScheduleEvent, updateScheduleEvent } from "@/lib/admin-events";
import { formatEventTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { finalExamsSchedule } from "./final-exams-data";

const groups = ["Final Exams", "Preparatory", "Freshman", "Sophomore", "Junior", "Senior"] as const;
type GroupLabel = (typeof groups)[number];

export type FreshmanLesson = {
  id: string;
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
  cohort: "Cohort 1" | "Cohort 2" | "Both";
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "10:30"
  title: string;
  instructor: string;
  room: string;
};

const defaultFreshmanSchedule: FreshmanLesson[] = [
  // Monday
  { id: "m1", day: "MONDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Audiences for Communications and Media", instructor: "Soheil Ashrafi", room: "Room: 203" },
  { id: "m2", day: "MONDAY", cohort: "Cohort 1", startTime: "11:00", endTime: "12:30", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
  { id: "m3", day: "MONDAY", cohort: "Cohort 1", startTime: "13:30", endTime: "16:30", title: "English Writing for Media", instructor: "Levi Bridges", room: "Room: 209" },
  { id: "m4", day: "MONDAY", cohort: "Cohort 1", startTime: "16:45", endTime: "17:30", title: "Physical training", instructor: "Tynchtykbek Makerov", room: "Sport Bubble" },
  { id: "m5", day: "MONDAY", cohort: "Cohort 2", startTime: "11:00", endTime: "12:30", title: "Calculus II", instructor: "Dr. Azmat Hussain", room: "Room: 209" },

  // Tuesday
  { id: "t1", day: "TUESDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Statistics", instructor: "Attique Ahmed", room: "Room: 201" },
  { id: "t2", day: "TUESDAY", cohort: "Cohort 1", startTime: "11:00", endTime: "12:30", title: "Kyrgyz language Intermediate Level", instructor: "Meerim Tursunalieva", room: "Room: 204" },
  { id: "t3", day: "TUESDAY", cohort: "Cohort 1", startTime: "13:30", endTime: "15:00", title: "Kyrgyz language Elementary Level", instructor: "Meerim Tursunalieva", room: "Room: 204" },
  { id: "t4", day: "TUESDAY", cohort: "Cohort 1", startTime: "15:30", endTime: "17:00", title: "Geography of Kyrgyzstan (Weeks: 9-16)", instructor: "Cholpon Turdalieva", room: "Online" },
  { id: "t5", day: "TUESDAY", cohort: "Cohort 2", startTime: "09:00", endTime: "10:30", title: "Programming II", instructor: "TBD", room: "Room: 111" },
  { id: "t6", day: "TUESDAY", cohort: "Cohort 2", startTime: "13:30", endTime: "15:00", title: "Programming II", instructor: "TBD", room: "Room: 111" },
  { id: "t7", day: "TUESDAY", cohort: "Cohort 2", startTime: "17:30", endTime: "18:15", title: "Physical training", instructor: "Tynchtykbek Makerov", room: "Sport Bubble" },

  // Wednesday
  { id: "w1", day: "WEDNESDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
  { id: "w2", day: "WEDNESDAY", cohort: "Cohort 1", startTime: "11:00", endTime: "12:30", title: "Audiences for Communications and Media", instructor: "Soheil Ashrafi", room: "Room: 203" },
  { id: "w3", day: "WEDNESDAY", cohort: "Cohort 1", startTime: "13:30", endTime: "15:00", title: "Kyrgyz language Beginner Level", instructor: "Meerim Tursunalieva", room: "Room: 204" },
  { id: "w4", day: "WEDNESDAY", cohort: "Cohort 1", startTime: "15:30", endTime: "17:00", title: "Kyrgyz language Elementary Level", instructor: "Meerim Tursunalieva", room: "Room: 204" },
  { id: "w5", day: "WEDNESDAY", cohort: "Cohort 2", startTime: "09:00", endTime: "10:30", title: "Physics II", instructor: "Sajjad Akbar", room: "Room: 209" },
  { id: "w6", day: "WEDNESDAY", cohort: "Cohort 2", startTime: "11:00", endTime: "12:30", title: "Calculus II", instructor: "Dr. Azmat Hussain", room: "Room: 209" },

  // Thursday
  { id: "th1", day: "THURSDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Statistics", instructor: "Attique Ahmed", room: "Room: 201" },
  { id: "th2", day: "THURSDAY", cohort: "Cohort 1", startTime: "11:00", endTime: "12:30", title: "Kyrgyz language Beginner Level", instructor: "Meerim Tursunalieva", room: "Room: 203" },
  { id: "th3", day: "THURSDAY", cohort: "Cohort 1", startTime: "13:30", endTime: "15:00", title: "Kyrgyz language Intermediate Level", instructor: "Meerim Tursunalieva", room: "Room: 203" },
  { id: "th4", day: "THURSDAY", cohort: "Cohort 1", startTime: "15:30", endTime: "17:00", title: "Geography of Kyrgyzstan (Weeks: 9-16)", instructor: "Cholpon Turdalieva", room: "Online" },
  { id: "th5", day: "THURSDAY", cohort: "Cohort 2", startTime: "09:00", endTime: "10:30", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
  { id: "th6", day: "THURSDAY", cohort: "Cohort 2", startTime: "13:30", endTime: "15:00", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
  { id: "th7", day: "THURSDAY", cohort: "Both", startTime: "17:00", endTime: "18:30", title: "FACULTY MEETING", instructor: "", room: "" },

  // Friday
  { id: "f1", day: "FRIDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "Audiences for Communications and Media", instructor: "Soheil Ashrafi", room: "Room: 203" },
  { id: "f2", day: "FRIDAY", cohort: "Cohort 1", startTime: "11:00", endTime: "12:30", title: "Statistics", instructor: "Attique Ahmed", room: "Room: 201" },
  { id: "f3", day: "FRIDAY", cohort: "Cohort 1", startTime: "13:30", endTime: "15:00", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
  { id: "f4", day: "FRIDAY", cohort: "Cohort 1", startTime: "15:30", endTime: "17:00", title: "English Writing for Media", instructor: "Levi Bridges", room: "Room: 209" },
  { id: "f5", day: "FRIDAY", cohort: "Cohort 2", startTime: "09:00", endTime: "10:30", title: "Physics II", instructor: "Sajjad Akbar", room: "Room: 209" },
  { id: "f6", day: "FRIDAY", cohort: "Cohort 2", startTime: "11:00", endTime: "12:30", title: "Calculus II", instructor: "Dr. Azmat Hussain", room: "Room: 209" },
  { id: "f7", day: "FRIDAY", cohort: "Cohort 2", startTime: "13:30", endTime: "15:00", title: "Programming II", instructor: "TBD", room: "Room: 111" },
  { id: "f8", day: "FRIDAY", cohort: "Cohort 2", startTime: "15:30", endTime: "17:00", title: "Sociology", instructor: "Amrisho Lashkariev", room: "Room: 206" },
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

// Calendar starts at 8:00 and ends at 19:00 (11 hours)
const CALENDAR_START = 8 * 60;
const CALENDAR_END = 19 * 60;
const CALENDAR_DURATION = CALENDAR_END - CALENDAR_START;

export default function LessonsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<GroupLabel>("Final Exams");
  const [status, setStatus] = useState("");

  const [isEditingFreshman, setIsEditingFreshman] = useState(false);
  const [freshmanForm, setFreshmanForm] = useState<FreshmanLesson[]>(defaultFreshmanSchedule);

  const lessons = useEvents({ type: "lesson", group: activeGroup });
  
  const freshmanEvents = useEvents({ type: "lesson", group: "Freshman_Template" });
  const freshmanPrimaryEvent = (freshmanEvents.data ?? [])[0] ?? null;
  const freshmanSchedule = parseFreshmanSchedule(freshmanPrimaryEvent?.description);

  const sortedLessons = (lessons.data ?? []).slice().sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const saveFreshmanSchedule = async () => {
    if (!isAdmin) return;
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);
      const description = JSON.stringify(freshmanForm);

      if (freshmanPrimaryEvent) {
        await updateScheduleEvent(freshmanPrimaryEvent.id, {
          title: "Freshman Template",
          type: "lesson",
          location: "Template",
          group: "Freshman_Template",
          start,
          end,
          description,
        });
      } else {
        await createScheduleEvent({
          title: "Freshman Template",
          type: "lesson",
          location: "Template",
          group: "Freshman_Template",
          start,
          end,
          description,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("Freshman schedule updated successfully.");
      setIsEditingFreshman(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save freshman schedule.");
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Lessons</h1>

      <div className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={
              group === activeGroup
                ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            }
          >
            {group}
          </button>
        ))}
      </div>

      {activeGroup === "Final Exams" && (
        <Card className="space-y-4 border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Final Exams Schedule (May 11 - May 15, 2026)</h2>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
            <div className="min-w-[1200px] text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                  <th className="p-3 font-semibold border-r border-slate-200 w-[150px] sticky left-0 z-20 bg-slate-100">Cohort</th>
                  <th className="p-3 font-semibold border-r border-slate-200 w-[210px] text-center">Monday<br/><span className="font-normal text-xs text-slate-500">May 11, 2026</span></th>
                  <th className="p-3 font-semibold border-r border-slate-200 w-[210px] text-center">Tuesday<br/><span className="font-normal text-xs text-slate-500">May 12, 2026</span></th>
                  <th className="p-3 font-semibold border-r border-slate-200 w-[210px] text-center">Wednesday<br/><span className="font-normal text-xs text-slate-500">May 13, 2026</span></th>
                  <th className="p-3 font-semibold border-r border-slate-200 w-[210px] text-center">Thursday<br/><span className="font-normal text-xs text-slate-500">May 14, 2026</span></th>
                  <th className="p-3 font-semibold w-[210px] text-center">Friday<br/><span className="font-normal text-xs text-slate-500">May 15, 2026</span></th>
                </tr>
              </thead>
              <tbody>
                {finalExamsSchedule.map((row) => (
                  <tr key={row.cohort} className={`border-b border-slate-200 ${row.rowBg} transition-colors`}>
                    <td className={`p-3 border-r border-slate-200 font-bold text-center text-xs leading-tight ${row.cohortBg} ${row.cohortText} sticky left-0 z-10 backdrop-blur-md`}>{row.cohort}</td>
                    {[row.monday, row.tuesday, row.wednesday, row.thursday, row.friday].map((dayExams, i) => (
                      <td key={i} className="p-2 border-r last:border-r-0 border-slate-200 align-top">
                        {dayExams.map((exam, eIdx) => (
                          <div key={eIdx} className={`mb-3 last:mb-0 text-center ${eIdx > 0 ? 'pt-3 border-t border-slate-200' : ''}`}>
                            <div className={`font-bold ${exam.color || 'text-slate-900'} mb-1`}>{exam.subject}</div>
                            {exam.roomsAndInstructors.map((ri, rIdx) => (
                              <div key={rIdx} className="text-[11px] text-slate-600 leading-snug">{ri}</div>
                            ))}
                            {exam.notes && <div className="text-[11px] text-slate-500 italic mt-0.5">({exam.notes})</div>}
                            <div className="text-[11px] font-semibold text-slate-700 mt-1">{exam.time}</div>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </Card>
      )}

      {activeGroup === "Freshman" && (
        <Card className="space-y-4 border-slate-200 bg-slate-50/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Freshman Weekly Schedule</h2>
            {isAdmin && !isEditingFreshman && (
              <Button onClick={() => {
                setFreshmanForm(freshmanSchedule);
                setIsEditingFreshman(true);
              }}>
                Edit Schedule
              </Button>
            )}
            {isAdmin && isEditingFreshman && (
              <div className="flex gap-2">
                <Button onClick={saveFreshmanSchedule}>Save</Button>
                <Button variant="outline" onClick={() => setIsEditingFreshman(false)}>Cancel</Button>
                <Button variant="outline" onClick={() => setFreshmanForm([...freshmanForm, { id: Math.random().toString(), day: "MONDAY", cohort: "Cohort 1", startTime: "09:00", endTime: "10:30", title: "", instructor: "", room: "" }])}>+ Lesson</Button>
              </div>
            )}
          </div>

          {isEditingFreshman ? (
            <div className="space-y-3">
              {freshmanForm.map((lesson, idx) => {
                const update = (field: keyof FreshmanLesson, val: string) => {
                  const newF = [...freshmanForm];
                  newF[idx] = { ...newF[idx], [field]: val };
                  setFreshmanForm(newF);
                };
                return (
                  <div key={lesson.id} className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <select className="border border-slate-300 rounded px-2 py-1 text-sm" value={lesson.day} onChange={e => update("day", e.target.value as FreshmanLesson["day"])}>
                      {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(d => <option key={d}>{d}</option>)}
                    </select>
                    <select className="border border-slate-300 rounded px-2 py-1 text-sm" value={lesson.cohort} onChange={e => update("cohort", e.target.value as FreshmanLesson["cohort"])}>
                      <option>Cohort 1</option>
                      <option>Cohort 2</option>
                      <option>Both</option>
                    </select>
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm w-20" placeholder="09:00" value={lesson.startTime} onChange={e => update("startTime", e.target.value)} />
                    <span className="text-slate-400">-</span>
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm w-20" placeholder="10:30" value={lesson.endTime} onChange={e => update("endTime", e.target.value)} />
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 min-w-[150px]" placeholder="Title" value={lesson.title} onChange={e => update("title", e.target.value)} />
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm w-32" placeholder="Instructor" value={lesson.instructor} onChange={e => update("instructor", e.target.value)} />
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm w-24" placeholder="Room" value={lesson.room} onChange={e => update("room", e.target.value)} />
                    <Button variant="outline" className="h-8 w-8 text-red-500 p-0 flex items-center justify-center" onClick={() => {
                      const newF = [...freshmanForm];
                      newF.splice(idx, 1);
                      setFreshmanForm(newF);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 bg-white rounded-2xl shadow-sm">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] border-b border-slate-200 bg-slate-50/80">
                  <div className="p-4 border-r border-slate-200 font-semibold text-slate-500 text-xs flex items-center justify-center sticky left-0 z-20 bg-slate-50">TIME</div>
                  {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => (
                    <div key={day} className="p-3 border-r last:border-r-0 border-slate-200 text-center">
                      <div className="font-bold text-slate-800 mb-2 tracking-wide">{day}</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                        <div className="border-b-2 border-indigo-200 pb-1">Cohort 1 (Arts)</div>
                        <div className="border-b-2 border-emerald-200 pb-1">Cohort 2 (Science)</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] relative h-[800px] bg-slate-50/30">
                  {/* Time labels axis */}
                  <div className="border-r border-slate-200 relative bg-slate-50 sticky left-0 z-20">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="absolute w-full border-t border-slate-200 text-[10px] text-slate-400 font-medium px-1 py-1 text-center" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }}>
                        {String(8 + i).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => {
                    const dayLessons = freshmanSchedule.filter(l => l.day === day);
                    return (
                      <div key={day} className="border-r last:border-r-0 border-slate-200 relative">
                        {/* Background hour lines */}
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="absolute w-full border-t border-slate-100" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }} />
                        ))}

                        {/* Lessons */}
                        {dayLessons.map(lesson => {
                          const startMins = timeToMinutes(lesson.startTime);
                          const endMins = timeToMinutes(lesson.endTime);
                          const topPct = ((startMins - CALENDAR_START) / CALENDAR_DURATION) * 100;
                          const heightPct = ((endMins - startMins) / CALENDAR_DURATION) * 100;

                          const isCohort1 = lesson.cohort === "Cohort 1";
                          const isCohort2 = lesson.cohort === "Cohort 2";
                          const isBoth = lesson.cohort === "Both";

                          const left = isCohort2 ? "50%" : "0%";
                          const width = isBoth ? "100%" : "50%";
                          const colorClass = isBoth ? "border-slate-300 bg-white shadow-sm" : isCohort1 ? "border-l-indigo-400 border-indigo-100 bg-indigo-50/40" : "border-l-emerald-400 border-emerald-100 bg-emerald-50/40";
                          const textClass = isBoth ? "text-slate-800" : isCohort1 ? "text-indigo-950" : "text-emerald-950";

                          const isShort = (endMins - startMins) <= 45;

                          return (
                            <div 
                              key={lesson.id} 
                              className={`absolute p-1.5 rounded border shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden transition-all hover:shadow-md ${colorClass} ${isBoth ? 'border-l-4' : 'border-l-[3px]'}`}
                              style={{ top: `${topPct}%`, height: `${heightPct}%`, left, width, zIndex: 10 }}
                            >
                              {isShort ? (
                                <div className="h-full flex flex-col justify-center">
                                  <div className={`text-[10px] font-bold leading-tight truncate ${textClass}`}>{lesson.title}</div>
                                  <div className="text-[9px] text-slate-600 truncate leading-tight mt-0.5">
                                    {lesson.startTime}-{lesson.endTime} • {lesson.instructor} {lesson.room && `(${lesson.room})`}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col justify-start">
                                  <div className={`text-[11px] font-bold leading-tight line-clamp-2 ${textClass}`}>{lesson.title}</div>
                                  <div className="text-[9px] font-semibold text-slate-500 mt-0.5">{lesson.startTime} - {lesson.endTime}</div>
                                  <div className="text-[9px] text-slate-600 truncate mt-auto leading-tight">{lesson.instructor}</div>
                                  {lesson.room && <div className="text-[9px] text-slate-600 font-medium truncate leading-tight">{lesson.room}</div>}
                                </div>
                              )}
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
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </Card>
      )}

      {activeGroup !== "Freshman" && activeGroup !== "Final Exams" && (
        <div className="space-y-3">
          {sortedLessons.map((lesson) => (
            <Card key={lesson.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{lesson.title}</h3>
                  <p className="text-sm text-slate-600">
                    {lesson.location} | {formatEventTime(lesson.start)} - {formatEventTime(lesson.end)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{lesson.description}</p>
                </div>
              </div>
            </Card>
          ))}
          {!sortedLessons.length && (
            <Card>
              <p className="text-sm text-slate-600">No lessons for {activeGroup} yet.</p>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

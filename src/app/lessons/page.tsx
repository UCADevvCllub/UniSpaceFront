"use client";
import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchClassEvents, djangoApi } from "@/lib/events";
import { mapDjangoToUi, formatEventTime } from "@/lib/utils";
import { finalExamsSchedule } from "./final-exams-data";
import { useEvents } from "@/hooks/use-events";

import { motion, AnimatePresence, useMotionValue, PanInfo } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteClassEvent } from "@/lib/events";
import { updateClassEvent } from "@/lib/events";
import { Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { reverseDayMap } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import {
  fetchEvents,
  fetchSubjects,
  fetchInstructors,
  fetchRooms,
  fetchCohorts
} from "@/lib/events";
// --- CONSTANTS ---
// bib bo



const groups = ["Freshman", "Sophomore", "Junior", "Senior"] as const;
type GroupLabel = (typeof groups)[number];


const CALENDAR_START = 8 * 60;
const CALENDAR_DURATION = (19 * 60) - CALENDAR_START;
const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

const timeToMinutes = (time: string) => {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// Converts a raw minutes-from-midnight value into a clamped "HH:MM", snapped to snapMinutes
const minutesToTimeStr = (totalMinutes: number, snapMinutes: number = 15) => {
  const clamped = Math.max(CALENDAR_START, Math.min(totalMinutes, CALENDAR_START + CALENDAR_DURATION));
  const snapped = Math.round(clamped / snapMinutes) * snapMinutes;
  const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
  const mm = String(snapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

// Given a drag's current pointer position and where on the card it was grabbed,
// resolves the day column + 5-min-snapped time the card's top-left corner now implies.
type DragStart = { grabOffsetX: number; grabOffsetY: number; columnRect: DOMRect };

function resolveSnappedTarget(lesson: any, info: PanInfo, dragStart: DragStart) {
  const impliedTopPx = info.point.y - dragStart.grabOffsetY;
  const impliedLeftPx = info.point.x - dragStart.grabOffsetX;

  const originIndex = DAY_ORDER.indexOf(lesson.day);
  const baseLeftFraction = lesson.cohortColumn === "Cohort 2" ? 0.5 : 0;
  const originCardLeftPx = dragStart.columnRect.left + baseLeftFraction * dragStart.columnRect.width;
  const deltaColumns = Math.round((impliedLeftPx - originCardLeftPx) / dragStart.columnRect.width);
  const targetIndex = Math.min(DAY_ORDER.length - 1, Math.max(0, originIndex + deltaColumns));
  const dayFull = DAY_ORDER[targetIndex];

  const minutesFromStart = ((impliedTopPx - dragStart.columnRect.top) / dragStart.columnRect.height) * CALENDAR_DURATION;
  const time = minutesToTimeStr(CALENDAR_START + minutesFromStart, 5);

  return { dayFull, time };
}

const MIN_LESSON_MINUTES = 30;

const percentOfCalendar = (min: number) => ((min - CALENDAR_START) / CALENDAR_DURATION) * 100;

const formatMinutes = (min: number) => {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

// 5-min snap, clamped between min/max (used to enforce the 30-min minimum duration)
const snapResizeMinutes = (raw: number, min: number, max: number) => {
  const snapped = Math.round(raw / 5) * 5;
  return Math.max(min, Math.min(snapped, max));
};

type ResizeStart = { edge: "start" | "end"; pointerStartY: number; originStartMin: number; originEndMin: number; columnHeight: number };

function computeResizePreview(lesson: any, rs: ResizeStart, info: PanInfo) {
  const deltaMinutes = ((info.point.y - rs.pointerStartY) / rs.columnHeight) * CALENDAR_DURATION;
  if (rs.edge === "start") {
    const min = snapResizeMinutes(rs.originStartMin + deltaMinutes, CALENDAR_START, rs.originEndMin - MIN_LESSON_MINUTES);
    return { start_time: formatMinutes(min), end_time: lesson.endTime };
  }
  const min = snapResizeMinutes(rs.originEndMin + deltaMinutes, rs.originStartMin + MIN_LESSON_MINUTES, CALENDAR_START + CALENDAR_DURATION);
  return { start_time: lesson.startTime, end_time: formatMinutes(min) };
}


const academicYearToId: Record<string, number> = {
  "Freshman": 1,
  "Sophomore": 2,
  "Junior": 3,
  "Senior": 4
};




export default function LessonsPage() {


  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: instructors } = useQuery({ queryKey: ["instructors"], queryFn: fetchInstructors });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const { data: cohorts } = useQuery({ queryKey: ["cohorts"], queryFn: fetchCohorts });
  // Groups the cohort dropdown by study year (Freshman -> Senior), CS before CM within each year
  const sortedCohorts = useMemo(() => {
    if (!cohorts) return [];
    return [...cohorts].sort((a: any, b: any) => {
      if (a.study_year_id !== b.study_year_id) return a.study_year_id - b.study_year_id;
      return a.cohort_name === "CS" ? -1 : b.cohort_name === "CS" ? 1 : 0;
    });
  }, [cohorts]);
  const { data: events } = useQuery({ queryKey: ["events"], queryFn: fetchEvents});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject_id: "",
    instructor_id: "",
    cohort_id: "",
    room_id: "",
    day: "MON",
    start_time: "09:00",
    end_time: "10:30"
  });



  const [status, setStatus] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);


  const handleEditClick = (lesson: any) => {
    if (!isAdmin) return;
    setFormData({
      subject_id: lesson.subjectId, 
      instructor_id: lesson.instructorId,
      cohort_id: lesson.cohortId,
      room_id: lesson.roomId,
      day: reverseDayMap[lesson.day] || "MON", 
      start_time: lesson.startTime,
      end_time: lesson.endTime
    });
    setEditingId(lesson.id);
    setIsModalOpen(true);
  };
  
  // Function to open modal for ADDING
  const handleAddClick = () => {
    if (!isAdmin) return;
    setFormData({
      subject_id: "", instructor_id: "", cohort_id: "", room_id: "",
      day: "MON", start_time: "09:00", end_time: "10:30"
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // Opens the Add Lesson modal pre-filled with the day/time/cohort clicked on the calendar grid
  const handleSlotClick = (dayFull: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdmin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const minutesFromStart = (offsetY / rect.height) * CALENDAR_DURATION;
    const startTime = minutesToTimeStr(CALENDAR_START + minutesFromStart);
    const endTime = minutesToTimeStr(timeToMinutes(startTime) + 90);

    // left half = CS, right half = CM, within the active tab's study year
    const isCsHalf = offsetX < rect.width / 2;
    const studyYearId = academicYearToId[activeGroup];
    const cohort = sortedCohorts.find(
      (c: any) => c.study_year_id === studyYearId && (c.cohort_name === "CS") === isCsHalf,
    );

    setFormData({
      subject_id: "", instructor_id: "", room_id: "",
      cohort_id: cohort ? String(cohort.id) : "",
      day: reverseDayMap[dayFull] || "MON",
      start_time: startTime,
      end_time: endTime,
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // Shared save path for both moving and resizing a lesson. onRejected fires only if the
  // backend rejects it (e.g. a conflict), so the card can snap back — on success it just
  // stays put, no revert needed.
  const patchLesson = (
    lesson: any,
    patch: { day: string; start_time: string; end_time: string },
    onRejected?: () => void,
  ) => {
    if (!isAdmin) return;
    updateMutation.mutate(
      {
        id: lesson.id,
        data: {
          subject_id: lesson.subjectId,
          instructor_id: lesson.instructorId,
          cohort_id: lesson.cohortId,
          room_id: lesson.roomId,
          ...patch,
        },
      },
      { onError: () => onRejected?.() },
    );
  };

  // Applies an already-resolved (day, time) drop target to a lesson
  const applyLessonMove = (
    lesson: any,
    target: { dayFull: string; time: string },
    onRejected?: () => void,
  ) => {
    const newDay = reverseDayMap[target.dayFull] || lesson.day;
    const oldDay = reverseDayMap[lesson.day] || lesson.day;
    if (newDay === oldDay && target.time === lesson.startTime) return; // dropped back where it started

    const duration = timeToMinutes(lesson.endTime) - timeToMinutes(lesson.startTime);
    const newEnd = minutesToTimeStr(timeToMinutes(target.time) + duration, 5);
    patchLesson(lesson, { day: newDay, start_time: target.time, end_time: newEnd }, onRejected);
  };

  // Applies a resized start or end time to a lesson, day/other edge unchanged
  const applyLessonResize = (
    lesson: any,
    edge: "start" | "end",
    newTime: string,
    onRejected?: () => void,
  ) => {
    const start_time = edge === "start" ? newTime : lesson.startTime;
    const end_time = edge === "end" ? newTime : lesson.endTime;
    if (start_time === lesson.startTime && end_time === lesson.endTime) return;
    patchLesson(lesson, { day: reverseDayMap[lesson.day] || lesson.day, start_time, end_time }, onRejected);
  };


  // edite button

  const updateMutation = useMutation({
    //object containing both the ID and the Data
    mutationFn: ({ id, data }: { id: string, data: typeof formData }) => 
      updateClassEvent(id, data),
      
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["django-class-events"] });
      setIsModalOpen(false);
      setEditingId(null); 
      toast.success("Lesson updated successfully", {
        description: "The schedule has been updated.",
      });
    },
    onError: (error: any) => {
      toast.error("Could not update lesson", {
        description: "There might be a Lesson conflict.",
      });
    }
  });
// create button
  const createMutation = useMutation({
    mutationFn: async (newData: typeof formData) => {
      const payload = {
        subject_id: parseInt(newData.subject_id),
        instructor_id: parseInt(newData.instructor_id),
        cohort_id: parseInt(newData.cohort_id),
        room_id: parseInt(newData.room_id),
        event_data: {
          day: newData.day,
          start_time: newData.start_time + ":00", 
          end_time: newData.end_time + ":00",
          status: "CLASS"
        }
      };
    return djangoApi.post(`/api/class-events/`, payload);
    },


    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["django-class-events"] });
      setIsModalOpen(false);
      toast.success("Lesson created successfully", {
        description: "The Lesson has been created.",
      });
    },
    onError: (error: any) => {
      toast.error("Could not create lesson", {
        description: "There might be a Lesson conflict.",
      });
    }
  });

// delete button
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClassEvent(id),
  onSuccess: () => {
    // refresher
    queryClient.invalidateQueries({ queryKey: ["django-class-events"] });
    setStatus("Lesson deleted successfully");
  },
  onError: (error) => {
    console.error("Delete failed:", error);
    setStatus("Failed to delete lesson");
  }
  });

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    if (window.confirm("Are you sure you want to delete this lesson?")) {
      deleteMutation.mutate(id);
    }
  };
  
  const [activeGroup, setActiveGroup] = useState<GroupLabel>("Freshman");


  const { data: djangoData, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-class-events"],
    queryFn: fetchClassEvents,
  });



  const filteredSchedule = useMemo(() => {
    if (!djangoData) return [];
    const mapped = mapDjangoToUi(djangoData);
    const targetId = academicYearToId[activeGroup];

    const result = mapped.filter(item => item.yearId === targetId);
    console.log(`Filtering for ${activeGroup} (ID: ${targetId}). Found:`, result.length);
    return result;
  }, [djangoData, activeGroup]);
  


  return (
    <>
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
        {isAdmin && (
          <Button
            onClick={handleAddClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            <span className="text-lg">+</span> Add Lesson
          </Button>
        )}
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
                      <div>CS / Science</div><div>CM / Arts</div>
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
                  <div
                    key={day}
                    data-day={day}
                    className={`border-r border-slate-100 relative last:border-r-0 ${isAdmin ? "cursor-pointer" : ""}`}
                    onClick={isAdmin ? (e) => handleSlotClick(day, e) : undefined}
                  >
                    {/* Hour Lines */}
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="absolute w-full border-t border-slate-100" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }} />
                    ))}

                    {/* Lessons */}
                    {filteredSchedule.filter(l => l.day === day).map(lesson => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        isAdmin={isAdmin}
                        onEdit={handleEditClick}
                        onDelete={handleDelete}
                        onMove={applyLessonMove}
                        onResize={applyLessonResize}
                      />
                    ))}
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

    <Toaster position="bottom-right" richColors />

   {/* reponsible for the panel that appears */}
   <AnimatePresence>
    {isModalOpen && (
        <div className="fixed inset-0  flex items-center justify-center z-[100] p-4">

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)} // Close when clicking outside
            className="fixed inset-0"
          />
           
           {/* 4. THE PANEL (Pops and Scales in) */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}    
            exit={{ scale: 0.9, opacity: 0, y: 20 }}    
            transition={{ type: "spring", damping: 25, stiffness: 400 }} 
            className="w-full max-w-md z-10"
          >

           

          <Card className="w-full max-w-md p-6 space-y-4 bg-white shadow-2xl border-none">
            <h2 className="text-xl font-bold text-slate-900">Add New Lesson</h2>
            
            <div className="grid gap-4">
              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <select 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                  value={formData.subject_id}
                  onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                >
                  <option value="">Select Subject</option>
                  {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Instructor */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Instructor</label>
                <select 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                  value={formData.instructor_id}
                  onChange={(e) => setFormData({...formData, instructor_id: e.target.value})}
                >
                  <option value="">Select Instructor</option>
                  {instructors?.map((i: any) => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
                </select>
              </div>

              {/* Day & Room */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Day</label>
                  <select 
                    className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                    value={formData.day}
                    onChange={(e) => setFormData({...formData, day: e.target.value})}
                  >
                    <option value="MON">Monday</option>
                    <option value="TUE">Tuesday</option>
                    <option value="WED">Wednesday</option>
                    <option value="THU">Thursday</option>
                    <option value="FRI">Friday</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Room</label>
                  <select 
                    className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                  >
                    <option value="">Select Room</option>
                    {rooms?.map((r: any) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                  </select>
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                  <input type="time" className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50" value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
                  <input type="time" className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50" value={formData.end_time} onChange={(e) => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>

              {/* Cohort */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Cohort</label>
                <select 
                  className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                  value={formData.cohort_id}
                  onChange={(e) => setFormData({...formData, cohort_id: e.target.value})}
                >
                  <option value="">Select Cohort</option>
                  {sortedCohorts.map((c: any) => <option key={c.id} value={c.id}>{c.cohort_name} (Year: {c.study_year_id})</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>

              <Button
            onClick={() => {
              if (!isAdmin) return;
              if (editingId) {
                // Pass ID and the form data
                updateMutation.mutate({ id: editingId, data: formData });
              } else {
                createMutation.mutate(formData);
              }
            }}
            // Check mutation loading states
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-indigo-600 text-white"
          >
            {editingId 
              ? (updateMutation.isPending ? "Updating..." : "Update Lesson") 
              : (createMutation.isPending ? "Saving..." : "Save Lesson")
            }
          </Button>
            </div>
          </Card>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>

  );
}

// Renders one lesson block on the calendar grid. Owns its own drag motion values (dragX/dragY)
// so it can override Framer Motion's raw drag output with a precise, grid-snapped position on
// every move — anchored to the card's own top-left corner (via the grab offset recorded on
// drag start), not the raw cursor position.
function LessonCard({
  lesson,
  isAdmin,
  onEdit,
  onDelete,
  onMove,
  onResize,
}: {
  lesson: any;
  isAdmin: boolean;
  onEdit: (lesson: any) => void;
  onDelete: (id: string) => void;
  onMove: (lesson: any, target: { dayFull: string; time: string }, onRejected?: () => void) => void;
  onResize: (lesson: any, edge: "start" | "end", newTime: string, onRejected?: () => void) => void;
}) {
  const dragStartRef = useRef<DragStart | null>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const resizeStartRef = useRef<ResizeStart | null>(null);
  const [resizePreview, setResizePreview] = useState<{ start_time: string; end_time: string } | null>(null);
  const [resizingEdge, setResizingEdge] = useState<"start" | "end" | null>(null);
  // Kept pinned at 0 always — the card's own height/top does the visual resizing;
  // these just stop Framer's default drag transform from also moving the handle itself.
  const startHandleY = useMotionValue(0);
  const endHandleY = useMotionValue(0);

  // Live text label only — position/size for rendering comes from topMV/heightMV below,
  // kept on the same synchronous motion-value pipeline as the handles so they never drift
  // apart during a drag (React state re-renders are a beat slower than motion value writes).
  const effectiveStart = resizePreview?.start_time ?? lesson.startTime;
  const effectiveEnd = resizePreview?.end_time ?? lesson.endTime;
  const startMins = timeToMinutes(lesson.startTime);
  const endMins = timeToMinutes(lesson.endTime);
  const top = percentOfCalendar(startMins);
  const height = percentOfCalendar(endMins) - percentOfCalendar(startMins);
  const left = lesson.cohortColumn === "Cohort 2" ? "50%" : "0%";

  const topMV = useMotionValue(`${top}%`);
  const heightMV = useMotionValue(`${height}%`);

  // Once the lesson's real data catches up (move or resize succeeded), the base top/height
  // already matches — reset here, before paint, so there's no visible jump. A rejected
  // move/resize resets immediately instead, via the respective onRejected callback.
  useLayoutEffect(() => {
    dragX.set(0);
    dragY.set(0);
    startHandleY.set(0);
    endHandleY.set(0);
    topMV.set(`${top}%`);
    heightMV.set(`${height}%`);
    setResizePreview(null);
  }, [lesson.day, lesson.startTime, lesson.endTime, lesson.cohortColumn, dragX, dragY, startHandleY, endHandleY, topMV, heightMV, top, height]);

  return (
    <motion.div
      drag={isAdmin}
      dragMomentum={false}
      style={{ top: topMV, height: heightMV, left, width: "50%", x: dragX, y: dragY }}
      onDragStart={(event, info) => {
        const columnEl = document.querySelector(`[data-day="${lesson.day}"]`);
        if (!(columnEl instanceof HTMLElement)) return;
        const columnRect = columnEl.getBoundingClientRect();
        const cardTopPx = columnRect.top + (top / 100) * columnRect.height;
        const cardLeftPx = columnRect.left + (lesson.cohortColumn === "Cohort 2" ? 0.5 : 0) * columnRect.width;
        dragStartRef.current = {
          grabOffsetX: info.point.x - cardLeftPx,
          grabOffsetY: info.point.y - cardTopPx,
          columnRect,
        };
      }}
      onDrag={(event, info) => {
        if (!dragStartRef.current) return;
        const target = resolveSnappedTarget(lesson, info, dragStartRef.current);
        const snappedTopPercent = ((timeToMinutes(target.time) - CALENDAR_START) / CALENDAR_DURATION) * 100;
        const dayShift = DAY_ORDER.indexOf(target.dayFull) - DAY_ORDER.indexOf(lesson.day);
        dragY.set(((snappedTopPercent - top) / 100) * dragStartRef.current.columnRect.height);
        dragX.set(dayShift * dragStartRef.current.columnRect.width);
      }}
      onDragEnd={(event, info) => {
        const dragStart = dragStartRef.current;
        dragStartRef.current = null;
        if (!dragStart) {
          dragX.set(0);
          dragY.set(0);
          return;
        }
        // Stay exactly where it was dropped — don't reset here. The layout effect above
        // clears the offset once the real data catches up (success), or onRejected below
        // clears it immediately if the backend rejects the move.
        const target = resolveSnappedTarget(lesson, info, dragStart);
        onMove(lesson, target, () => {
          dragX.set(0);
          dragY.set(0);
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute p-2 rounded border-l-4 shadow-sm bg-indigo-50 border-indigo-200 border-l-indigo-500 text-indigo-700 z-10 group hover:z-20 active:z-30 ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {isAdmin && (["start", "end"] as const).map((edge) => {
        const handleY = edge === "start" ? startHandleY : endHandleY;
        return (
          <motion.div
            key={edge}
            drag="y"
            dragMomentum={false}
            style={{ y: handleY, opacity: resizingEdge === edge ? 0 : undefined }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(event, info) => {
              const columnEl = document.querySelector(`[data-day="${lesson.day}"]`);
              if (!(columnEl instanceof HTMLElement)) return;
              setResizingEdge(edge);
              resizeStartRef.current = {
                edge,
                pointerStartY: info.point.y,
                originStartMin: timeToMinutes(lesson.startTime),
                originEndMin: timeToMinutes(lesson.endTime),
                columnHeight: columnEl.getBoundingClientRect().height,
              };
            }}
            onDrag={(event, info) => {
              if (!resizeStartRef.current) return;
              const preview = computeResizePreview(lesson, resizeStartRef.current, info);
              const previewStartMin = timeToMinutes(preview.start_time);
              const previewEndMin = timeToMinutes(preview.end_time);
              topMV.set(`${percentOfCalendar(previewStartMin)}%`);
              heightMV.set(`${percentOfCalendar(previewEndMin) - percentOfCalendar(previewStartMin)}%`);
              setResizePreview(preview);
              handleY.set(0);
            }}
            onDragEnd={(event, info) => {
              const rs = resizeStartRef.current;
              resizeStartRef.current = null;
              handleY.set(0);
              setResizingEdge(null);
              if (!rs) { setResizePreview(null); return; }
              const preview = computeResizePreview(lesson, rs, info);
              onResize(lesson, rs.edge, rs.edge === "start" ? preview.start_time : preview.end_time, () => {
                // rejected — snap the card back to its original size
                topMV.set(`${percentOfCalendar(rs.originStartMin)}%`);
                heightMV.set(`${percentOfCalendar(rs.originEndMin) - percentOfCalendar(rs.originStartMin)}%`);
                setResizePreview(null);
              });
            }}
            className={`absolute inset-x-0 ${edge === "start" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"} h-2 flex items-center justify-center cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity`}
          >
            <div className="h-0.5 w-6 rounded-full bg-indigo-500" />
          </motion.div>
        );
      })}
      <div className="text-[10px] font-bold truncate">{lesson.title}</div>
      <div className="text-[9px] font-medium">{effectiveStart}-{effectiveEnd}</div>
      <div className="text-[9px] font-bold mt-1 uppercase text-indigo-900">{lesson.room}</div>

      {isAdmin && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit(lesson);
        }}
        className="p-1 text-indigo-400 hover:text-indigo-600 bg-white/50 rounded shadow-sm"
      >
        <Pencil size={12} />
      </button>
      )}
      {isAdmin && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(lesson.id);
        }}
        className="absolute top-1 right-1 p-1 text-indigo-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
      )}
    </motion.div>
  );
}
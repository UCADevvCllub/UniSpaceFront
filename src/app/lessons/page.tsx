"use client";
import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchClassEvents, djangoApi } from "@/lib/events";
import { mapDjangoToUi, yearColumns } from "@/lib/utils";

import { motion, useMotionValue, PanInfo } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteClassEvent } from "@/lib/events";
import { updateClassEvent } from "@/lib/events";
import { Trash2, Pencil } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { reverseDayMap } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import {
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
const CALENDAR_DURATION = (21 * 60) - CALENDAR_START;
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
  const baseLeftFraction = (lesson.isCombined ? lesson.combinedColumnStart : lesson.columnIndex) / lesson.columnCount;
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

const yearIdToLabel: Record<number, GroupLabel> = {
  1: "Freshman",
  2: "Sophomore",
  3: "Junior",
  4: "Senior"
};

const COHORT_ORDER = ["CS", "CS_A", "CS_B", "CM"];

// "CS" or "CM" — the major a cohort belongs to (CS_A / CS_B are both CS)
const majorOf = (cohortName: string) => (cohortName.startsWith("CM") ? "CM" : "CS");

// The first message in a DRF 400 body, so the toast says what actually clashed
const apiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    return Array.isArray(first) ? String(first[0]) : String(first);
  }
  return fallback;
};




export default function LessonsPage() {


  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: instructors } = useQuery({ queryKey: ["instructors"], queryFn: fetchInstructors });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const subjectOptions = useMemo(
    () => (subjects ?? []).map((s: any) => ({ value: String(s.id), label: s.name })),
    [subjects],
  );
  const instructorOptions = useMemo(
    () =>
      (instructors ?? [])
        .map((i: any) => ({ value: String(i.id), label: `${i.first_name} ${i.last_name}` }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label)),
    [instructors],
  );
  const roomOptions = useMemo(
    () => (rooms ?? []).map((r: any) => ({ value: String(r.id), label: r.room_number })),
    [rooms],
  );
  const { data: cohorts } = useQuery({ queryKey: ["cohorts"], queryFn: fetchCohorts });
  // Groups the cohorts by study year (Freshman -> Senior), in calendar column order within each year
  const sortedCohorts = useMemo(() => {
    if (!cohorts) return [];
    return [...cohorts]
      .filter((c: any) => c.study_year_id >= 1 && c.study_year_id <= 4 && COHORT_ORDER.includes(c.cohort_name))
      .sort((a: any, b: any) => {
        if (a.study_year_id !== b.study_year_id) return a.study_year_id - b.study_year_id;
        return COHORT_ORDER.indexOf(a.cohort_name) - COHORT_ORDER.indexOf(b.cohort_name);
      });
  }, [cohorts]);

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
  // Other study years this class is also taught to (same major), ticked in the form
  const [extraYearIds, setExtraYearIds] = useState<number[]>([]);
  // When editing: the cohort picker value the form opened with, and the class's cohort ids
  // per year — so years/cohorts the admin didn't touch are saved exactly as they were.
  const [editOriginal, setEditOriginal] = useState<{ cohortValue: string; byYear: Record<number, string[]> } | null>(null);

  // Cohort ids of one major in one year, e.g. Freshman CS -> [CS_A, CS_B], Senior CS -> [CS]
  const majorCohortIds = (yearId: number, major: string) => {
    const names = yearColumns(yearId).map((col) => col.cohort).filter((name) => majorOf(name) === major);
    return sortedCohorts
      .filter((c: any) => c.study_year_id === yearId && names.includes(c.cohort_name))
      .map((c: any) => String(c.id));
  };

  // Every cohort the class is for: the cohort(s) picked for the year being viewed, plus the
  // same major(s) in each ticked extra year.
  const buildCohortIds = (): string[] => {
    const activeYearId = academicYearToId[activeGroup];
    let current: string[];
    if (editOriginal && formData.cohort_id === editOriginal.cohortValue) {
      current = editOriginal.byYear[activeYearId] ?? [];
    } else if (formData.cohort_id === "BOTH") {
      current = [...majorCohortIds(activeYearId, "CS"), ...majorCohortIds(activeYearId, "CM")];
    } else if (formData.cohort_id === "BOTH_AB") {
      current = majorCohortIds(activeYearId, "CS");
    } else {
      current = formData.cohort_id ? [String(formData.cohort_id)] : [];
    }
    if (current.length === 0) throw new Error("Select a cohort first.");

    const majors = new Set(
      current.map((id) => majorOf(cohorts?.find((c: any) => String(c.id) === id)?.cohort_name ?? "")),
    );
    const ids = [...current];
    for (const yearId of extraYearIds) {
      const existing = editOriginal?.byYear[yearId];
      if (existing?.length) {
        ids.push(...existing);
        continue;
      }
      for (const major of majors) {
        const found = majorCohortIds(yearId, major);
        if (found.length === 0) throw new Error(`There is no ${major} cohort for ${yearIdToLabel[yearId]}.`);
        ids.push(...found);
      }
    }
    return Array.from(new Set(ids));
  };


  const handleEditClick = (lesson: any) => {
    if (!isAdmin) return;
    // The cohort picker shows this year's part of the class: one cohort, or a "Both" option.
    const yearPart: string[] = lesson.yearCohortIds ?? [String(lesson.cohortId)];
    const yearNames = yearPart.map((id) => cohorts?.find((c: any) => String(c.id) === id)?.cohort_name ?? "");
    const cohortValue = yearPart.length === 1 ? yearPart[0] : yearNames.some((n) => n.startsWith("CM")) ? "BOTH" : "BOTH_AB";

    setFormData({
      subject_id: lesson.subjectId,
      instructor_id: lesson.instructorId,
      cohort_id: cohortValue,
      room_id: lesson.roomId,
      day: reverseDayMap[lesson.day] || "MON",
      start_time: lesson.startTime,
      end_time: lesson.endTime
    });
    setEditingId(lesson.id);
    setEditOriginal({ cohortValue, byYear: lesson.groupByYear ?? { [lesson.yearId]: yearPart } });
    setExtraYearIds(Object.keys(lesson.groupByYear ?? {}).map(Number).filter((y) => y !== lesson.yearId));
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
    setEditOriginal(null);
    setExtraYearIds([]);
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

    // Which sub-column was clicked (CS A / CS B / CM on Freshman, CS / CM otherwise) decides the cohort.
    const studyYearId = academicYearToId[activeGroup];
    const columns = yearColumns(studyYearId);
    const columnIndex = Math.min(columns.length - 1, Math.max(0, Math.floor((offsetX / rect.width) * columns.length)));
    const cohort = sortedCohorts.find(
      (c: any) => c.study_year_id === studyYearId && c.cohort_name === columns[columnIndex].cohort,
    );

    setFormData({
      subject_id: "", instructor_id: "", room_id: "",
      cohort_id: cohort ? String(cohort.id) : "",
      day: reverseDayMap[dayFull] || "MON",
      start_time: startTime,
      end_time: endTime,
    });
    setEditingId(null);
    setEditOriginal(null);
    setExtraYearIds([]);
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
        description: apiErrorMessage(error, "There might be a Lesson conflict."),
      });
    }
  });
  // Add / Edit form save: one request for the whole class, whichever cohorts and years it covers
  const saveMutation = useMutation({
    mutationFn: async ({ id, data, cohortIds }: { id: string | null; data: typeof formData; cohortIds: string[] }) => {
      const payload = {
        subject_id: parseInt(data.subject_id),
        instructor_id: parseInt(data.instructor_id),
        room_id: parseInt(data.room_id),
        cohort_ids: cohortIds.map((c) => parseInt(c)),
        event_data: {
          day: data.day,
          start_time: data.start_time.slice(0, 5) + ":00",
          end_time: data.end_time.slice(0, 5) + ":00",
          status: "CLASS"
        }
      };
      return id ? djangoApi.patch(`/api/class-events/${id}/`, payload) : djangoApi.post(`/api/class-events/`, payload);
    },

    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["django-class-events"] });
      setIsModalOpen(false);
      setEditingId(null);
      toast.success(id ? "Lesson updated successfully" : "Lesson created successfully");
    },
    onError: (error: any, { id }) => {
      toast.error(id ? "Could not update lesson" : "Could not create lesson", {
        description: apiErrorMessage(error, "There might be a Lesson conflict."),
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

  const handleDelete = (lesson: any) => {
    if (!isAdmin) return;
    const message = lesson.otherYears?.length
      ? `This lesson is shared with ${lesson.otherYears.join(", ")}. Delete it for all of them?`
      : "Are you sure you want to delete this lesson?";
    if (window.confirm(message)) {
      deleteMutation.mutate(lesson.id);
    }
  };

  const [activeGroup, setActiveGroup] = useState<GroupLabel>("Freshman");
  const activeColumns = yearColumns(academicYearToId[activeGroup]);

  const [isScrolledRight, setIsScrolledRight] = useState(false);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (scrollLeft > 15 && !isScrolledRight) {
      setIsScrolledRight(true);
    } else if (scrollLeft < 8 && isScrolledRight) {
      setIsScrolledRight(false);
    }
  };

  useEffect(() => {
    setIsScrolledRight(false);
  }, [activeGroup]);


  const { data: djangoData, isLoading: isDjangoLoading } = useQuery({
    queryKey: ["django-class-events"],
    queryFn: fetchClassEvents,
  });



  const allLessons = useMemo(() => (djangoData ? mapDjangoToUi(djangoData) : []), [djangoData]);

  const filteredSchedule = useMemo(() => {
    const targetId = academicYearToId[activeGroup];
    const groups = new Map<string, any[]>();
    for (const l of allLessons) {
      if (l.shareGroup) groups.set(l.shareGroup, [...(groups.get(l.shareGroup) ?? []), l]);
    }

    // One card per class in this year: the rows of a shared class that sit in this year are
    // merged into one entry spanning just the columns they cover (e.g. CS A + CS B), and the
    // card knows which other years the class is shared with.
    const merged: any[] = [];
    const seenGroups = new Set<string>();
    for (const lesson of allLessons.filter((l) => l.yearId === targetId)) {
      const members = lesson.shareGroup ? groups.get(lesson.shareGroup)! : [lesson];
      if (lesson.shareGroup) {
        if (seenGroups.has(lesson.shareGroup)) continue;
        seenGroups.add(lesson.shareGroup);
      }
      const here = members.filter((m) => m.yearId === targetId).sort((a, b) => a.columnIndex - b.columnIndex);
      const groupByYear: Record<number, string[]> = {};
      for (const m of members) (groupByYear[m.yearId] ??= []).push(String(m.cohortId));
      const otherYears = Object.keys(groupByYear).map(Number).filter((y) => y !== targetId)
        .sort((a, b) => a - b).map((y) => yearIdToLabel[y]).filter(Boolean);
      const columns = here.map((m) => m.columnIndex);
      const combinedColumnStart = Math.min(...columns);
      merged.push({
        ...lesson,
        isCombined: here.length > 1,
        combinedColumnStart,
        combinedColumnSpan: Math.max(...columns) - combinedColumnStart + 1,
        cohortLabel: here.map((m) => m.cohortName.replace("_", " ")).join(" + "),
        yearCohortIds: here.map((m) => String(m.cohortId)),
        groupByYear,
        otherYears,
      });
    }
    return merged;
  }, [allLessons, activeGroup]);



  return (
    <>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Lessons</h1>

        {/* --- NAVBAR --- */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={group === activeGroup
                ? "rounded-full bg-primary px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white shadow-md"
                : "rounded-full border border-slate-300 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"}
            >
              {group}
            </button>
          ))}
          {isAdmin && (
            <Button
              onClick={handleAddClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm"
            >
              <span className="text-base sm:text-lg">+</span> Add Lesson
            </Button>
          )}
        </div>



        {/* --- VIEW 3: ACADEMIC YEARS (GOOGLE GRID) ---
            Full-bleed: breaks out of the page's max-w-4xl column (which keeps the title/tabs
            above aligned with the SCHEDULES/LESSONS/... links) so the wide calendar gets the
            full viewport width instead of being squeezed into that same narrow column. */}
        {academicYearToId[activeGroup] && (
          <div className="relative left-1/2 right-1/2 w-screen -mx-[50vw] px-4 sm:px-6 lg:px-10">
            <Card className="p-6 border-slate-200 bg-slate-50/50">
              <h2 className="text-xl font-bold mb-4">{activeGroup} Schedule</h2>

              <div
                className="overflow-x-auto overflow-y-hidden border border-slate-200 bg-white rounded-2xl shadow-sm"
                onScroll={handleTableScroll}
              >
                <div style={{ minWidth: activeColumns.length === 3 ? 1695 : 1252 }}>
                  {/* Header Days */}
                  <div
                    className={`grid ${
                      isScrolledRight
                        ? "grid-cols-[32px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[34px_1fr_1fr_1fr_1fr_1fr]"
                        : "grid-cols-[48px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[65px_1fr_1fr_1fr_1fr_1fr]"
                    } border-b border-slate-200 bg-slate-50/80 transition-[grid-template-columns] duration-200`}
                  >
                    <div
                      className={`border-r border-slate-200 font-bold text-slate-400 flex items-center justify-center sticky left-0 z-20 bg-slate-50 transition-all duration-200 ${
                        isScrolledRight ? "text-[6.5px] px-[1px] py-1" : "text-[7.5px] sm:text-[8px] p-1 sm:p-2.5"
                      }`}
                    >
                      TIME
                    </div>
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => (
                      <div key={day} className="p-1 sm:p-2 border-r border-slate-200 text-center last:border-r-0">
                        <div className="font-bold text-slate-700 text-[8px] sm:text-[11px]">
                          <span className="sm:hidden">{day.slice(0, 3)}</span>
                          <span className="hidden sm:inline">{day}</span>
                        </div>
                        <div
                          className="grid text-[5.5px] sm:text-[7.5px] font-bold text-slate-400 mt-0.5"
                          style={{ gridTemplateColumns: `repeat(${activeColumns.length}, minmax(0, 1fr))` }}
                        >
                          {activeColumns.map((col) => <div key={col.cohort}>{col.label}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Grid Body */}
                  <div
                    className={`grid ${
                      isScrolledRight
                        ? "grid-cols-[32px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[34px_1fr_1fr_1fr_1fr_1fr]"
                        : "grid-cols-[48px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[65px_1fr_1fr_1fr_1fr_1fr]"
                    } relative h-[763px] bg-white transition-[grid-template-columns] duration-200`}
                  >
                    {/* Time Axis */}
                    <div className="border-r border-slate-200 bg-slate-50 sticky left-0 z-20 transition-all duration-200 shadow-[1px_0_3px_rgba(0,0,0,0.04)]">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div
                          key={i}
                          className={`absolute w-full text-[9px] text-slate-400 font-bold ${
                            isScrolledRight ? "pr-[3px]" : "pr-2"
                          } text-right transition-all duration-200`}
                          style={{
                            top: `${(i * 60 / CALENDAR_DURATION) * 100}%`,
                            transform:
                              i === 0
                                ? "translateY(2px)"
                                : i === 13
                                ? "translateY(calc(-100% - 2px))"
                                : "translateY(-50%)",
                          }}
                        >
                          {String(8 + i).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map((day) => (
                      <div
                        key={day}
                        data-day={day}
                        className={`border-r border-slate-200 relative last:border-r-0 ${isAdmin ? "cursor-pointer" : ""}`}
                        onClick={isAdmin ? (e) => handleSlotClick(day, e) : undefined}
                      >
                        {/* Hour Lines */}
                        {Array.from({ length: 14 }).map((_, i) => (
                          <div key={i} className="absolute w-full border-t border-slate-200" style={{ top: `${(i * 60 / CALENDAR_DURATION) * 100}%` }} />
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
          </div>
        )}
      </section>

      <Toaster position="bottom-right" richColors />

      {/* reponsible for the panel that appears */}
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setIsModalOpen(false)} // Close when clicking outside
          className="fixed inset-0  flex items-center justify-center z-[100] p-4"
        >

          {/* 4. THE PANEL (Pops and Scales in) */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md z-10"
          >



            <Card className="w-full max-w-md p-6 space-y-4 bg-white shadow-2xl border-none">
              <h2 className="text-xl font-bold text-slate-900">{editingId ? "Edit Lesson" : "Add New Lesson"}</h2>

              <div className="grid gap-4">
                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                  <SearchableSelect
                    value={formData.subject_id}
                    onChange={(v) => setFormData({ ...formData, subject_id: v })}
                    options={subjectOptions}
                    placeholder="Select Subject"
                    searchPlaceholder="Search subjects..."
                    emptyText="No subjects found"
                  />
                </div>

                {/* Instructor */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Instructor</label>
                  <SearchableSelect
                    value={formData.instructor_id}
                    onChange={(v) => setFormData({ ...formData, instructor_id: v })}
                    options={instructorOptions}
                    placeholder="Select Instructor"
                    searchPlaceholder="Search instructors..."
                    emptyText="No instructors found"
                  />
                </div>

                {/* Day & Room */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Day</label>
                    <select
                      className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                      value={formData.day}
                      onChange={(e) => setFormData({ ...formData, day: e.target.value })}
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
                    <SearchableSelect
                      value={formData.room_id}
                      onChange={(v) => setFormData({ ...formData, room_id: v })}
                      options={roomOptions}
                      placeholder="Select Room"
                      searchPlaceholder="Search rooms..."
                      emptyText="No rooms found"
                    />
                  </div>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                    <input type="time" className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
                    <input type="time" className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                  </div>
                </div>

                {/* Cohort */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cohort</label>
                  <select
                    className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50"
                    value={formData.cohort_id}
                    onChange={(e) => setFormData({ ...formData, cohort_id: e.target.value })}
                  >
                    <option value="">Select Cohort</option>
                    <option value="BOTH">Both CS and CM</option>
                    {activeColumns.length === 3 && (
                      <option value="BOTH_AB">Both CS A and CS B</option>
                    )}
                    {(() => {
                      const selectedCohort = cohorts?.find((c: any) => String(c.id) === String(formData.cohort_id));
                      const targetYearId = selectedCohort ? selectedCohort.study_year_id : academicYearToId[activeGroup];
                      const allowed = yearColumns(targetYearId).map((col) => col.cohort);
                      // Also keep the lesson's current cohort (e.g. an older plain CS one) so editing shows it.
                      return sortedCohorts
                        .filter((c: any) => c.study_year_id === targetYearId && (allowed.includes(c.cohort_name) || c.id === selectedCohort?.id))
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.cohort_name}
                          </option>
                        ));
                    })()}
                  </select>
                </div>

                {/* Other study years taking the same class (same major) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Also for other years</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {groups.filter((g) => g !== activeGroup).map((g) => {
                      const yearId = academicYearToId[g];
                      return (
                        <label key={g} className="flex items-center gap-1.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={extraYearIds.includes(yearId)}
                            onChange={(e) =>
                              setExtraYearIds(e.target.checked
                                ? [...extraYearIds, yearId]
                                : extraYearIds.filter((y) => y !== yearId))
                            }
                          />
                          {g}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">Adds the same major (CS or CM) in those years. Freshman CS means both CS A and CS B.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>

                <Button
                  onClick={() => {
                    if (!isAdmin) return;
                    let cohortIds: string[];
                    try {
                      cohortIds = buildCohortIds();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Select a cohort first.");
                      return;
                    }
                    saveMutation.mutate({ id: editingId, data: formData, cohortIds });
                  }}
                  // Check mutation loading states
                  disabled={saveMutation.isPending}
                  className="bg-indigo-600 text-white"
                >
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update Lesson" : "Save Lesson"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
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
  onDelete: (lesson: any) => void;
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
  // A combined lesson spans exactly the columns its two cohorts sit in (e.g. CS_A+CS_B
  // covers 2 of Freshman's 3 columns, leaving CM's column alone) — not always the full width.
  const colStart = lesson.isCombined ? lesson.combinedColumnStart : lesson.columnIndex;
  const colSpan = lesson.isCombined ? lesson.combinedColumnSpan : 1;
  const leftFraction = colStart / lesson.columnCount;
  // Purple for any class taught to more than one cohort, in this year or across years
  const isShared = lesson.isCombined || lesson.otherYears?.length > 0;
  const left = `${leftFraction * 100}%`;
  const width = `${(colSpan / lesson.columnCount) * 100}%`;

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
  }, [lesson.day, lesson.startTime, lesson.endTime, lesson.columnIndex, lesson.columnCount, lesson.isCombined, lesson.combinedColumnStart, lesson.combinedColumnSpan, dragX, dragY, startHandleY, endHandleY, topMV, heightMV, top, height]);

  return (
    <motion.div
      drag={isAdmin}
      dragMomentum={false}
      style={{ top: topMV, height: heightMV, left, width, x: dragX, y: dragY }}
      onDragStart={(event, info) => {
        const columnEl = document.querySelector(`[data-day="${lesson.day}"]`);
        if (!(columnEl instanceof HTMLElement)) return;
        const columnRect = columnEl.getBoundingClientRect();
        const cardTopPx = columnRect.top + (top / 100) * columnRect.height;
        const cardLeftPx = columnRect.left + leftFraction * columnRect.width;
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
      className={`absolute p-1 sm:p-1.5 rounded border-l-[3px] sm:border-l-4 shadow-sm z-10 group hover:z-[15] active:z-30 ${isShared
        ? "bg-purple-50 border-purple-200 border-l-purple-500 text-purple-700"
        : "bg-indigo-50 border-indigo-200 border-l-indigo-500 text-indigo-700"
        } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
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
            <div className="h-0.5 w-5 rounded-full bg-indigo-500" />
          </motion.div>
        );
      })}
      <div className="flex items-baseline gap-1 text-[9px] font-bold leading-tight">
        <span className="min-w-0 truncate">{lesson.title}</span>
        {lesson.isCombined && (
          <span className="shrink-0 font-semibold opacity-70">({lesson.cohortLabel})</span>
        )}
      </div>
      {lesson.otherYears?.length > 0 && (
        <div className="text-[8px] font-semibold truncate leading-tight">Shared with: {lesson.otherYears.join(", ")}</div>
      )}
      <div className="text-[8px] font-medium leading-tight">{effectiveStart}-{effectiveEnd}</div>
      <div className="text-[8px] font-medium truncate leading-tight">{lesson.instructor}</div>
      <div className={`text-[8px] font-bold mt-0.5 uppercase leading-tight ${isShared ? "text-purple-900" : "text-indigo-900"}`}>{lesson.room}</div>

      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(lesson);
          }}
          className="p-1 text-indigo-400 hover:text-indigo-600 bg-white/50 rounded shadow-sm"
        >
          <Pencil size={9} className="sm:hidden" />
          <Pencil size={11} className="hidden sm:block" />
        </button>
      )}
      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lesson);
          }}
          className="absolute top-1 right-1 p-1 text-indigo-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={10} className="sm:hidden" />
          <Trash2 size={12} className="hidden sm:block" />
        </button>
      )}
    </motion.div>
  );
}
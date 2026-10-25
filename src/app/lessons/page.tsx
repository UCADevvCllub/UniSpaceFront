"use client";
import { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchClassEvents, djangoApi, deleteClassEvent, updateClassEvent, fetchSubjects, fetchInstructors, fetchRooms, fetchCohorts } from "@/lib/events";
import { mapDjangoToUi, yearColumns, allYearCohorts, formatCohortName, FreshmanSubTab, reverseDayMap } from "@/lib/utils";

import { motion, useMotionValue, PanInfo } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast, Toaster } from "sonner";

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

const COHORT_ORDER = ["CS", "CS_A", "CS_B", "CS_DIRECT", "POST_PREP", "CM", "CM_DIRECT"];

// Every message in a DRF 400 body (one per clash), listed in the toast
const apiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  if (data && typeof data === "object") {
    const messages = Object.values(data).flatMap((v) => (Array.isArray(v) ? v : [v])).map(String);
    if (messages.length === 1) return messages[0];
    return (
      <ul className="list-disc pl-4 space-y-0.5">
        {messages.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    );
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
    cohort_ids: [] as string[],
    room_id: "",
    day: "MON",
    start_time: "09:00",
    end_time: "10:30",
  });

  const [status, setStatus] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Other study years this class is also taught to: year id -> the cohort ids picked there
  const [extraYears, setExtraYears] = useState<Record<number, string[]>>({});
  // Whether the "Share with other study years" section is expanded in the form
  const [showOtherYears, setShowOtherYears] = useState(false);

  // Every cohort the class is for: the cohort(s) picked for the year being viewed, plus the
  // cohorts ticked under each other study year.
  const buildCohortIds = (): string[] => {
    const current = formData.cohort_ids;
    if (!current || current.length === 0) throw new Error("Select at least one cohort.");

    const ids = [...current];
    for (const [yearId, picked] of Object.entries(extraYears)) {
      if (picked.length === 0) {
        throw new Error(`Pick at least one cohort for ${yearIdToLabel[Number(yearId)]}, or untick it.`);
      }
      ids.push(...picked);
    }
    return Array.from(new Set(ids));
  };

  // Cohorts that can be picked in a year: Freshman sections, or CS / CM for other years
  const yearCohortOptions = (yearId: number) => {
    const allowed = allYearCohorts(yearId).map((c) => c.cohort);
    return sortedCohorts.filter((c: any) => c.study_year_id === yearId && allowed.includes(c.cohort_name));
  };

  const handleEditClick = (lesson: any) => {
    if (!isAdmin) return;
    const yearPart: string[] = lesson.yearCohortIds ?? [String(lesson.cohortId)];

    setFormData({
      subject_id: String(lesson.subjectId),
      instructor_id: String(lesson.instructorId),
      cohort_ids: yearPart,
      room_id: String(lesson.roomId),
      day: reverseDayMap[lesson.day] || "MON",
      start_time: lesson.startTime,
      end_time: lesson.endTime
    });
    setEditingId(lesson.id);
    const others = Object.fromEntries(
      Object.entries(lesson.groupByYear ?? {}).filter(([y]) => Number(y) !== lesson.yearId),
    ) as Record<number, string[]>;
    setExtraYears(others);
    setShowOtherYears(Object.keys(others).length > 0);
    setIsModalOpen(true);
  };

  // Function to open modal for ADDING
  const handleAddClick = () => {
    if (!isAdmin) return;
    const targetYearId = academicYearToId[activeGroup];
    let defaultIds: string[] = [];
    if (activeGroup === "Freshman" && freshmanSubTab === "main") {
      const cmCohort = sortedCohorts.find((c: any) => c.study_year_id === 1 && c.cohort_name === "CM");
      if (cmCohort) defaultIds = [String(cmCohort.id)];
    } else {
      const defaultCohort = sortedCohorts.find(
        (c: any) => c.study_year_id === targetYearId && c.cohort_name === activeColumns[0]?.cohort,
      ) || sortedCohorts.find((c: any) => c.study_year_id === targetYearId);
      if (defaultCohort) defaultIds = [String(defaultCohort.id)];
    }

    setFormData({
      subject_id: "",
      instructor_id: "",
      cohort_ids: defaultIds,
      room_id: "",
      day: "MON",
      start_time: "09:00",
      end_time: "10:30"
    });
    setEditingId(null);
    setExtraYears({});
    setShowOtherYears(false);
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

    const studyYearId = academicYearToId[activeGroup];
    const columns = yearColumns(studyYearId, activeGroup === "Freshman" ? freshmanSubTab : undefined);
    const columnIndex = Math.min(columns.length - 1, Math.max(0, Math.floor((offsetX / rect.width) * columns.length)));

    let slotCohortIds: string[] = [];
    if (activeGroup === "Freshman" && freshmanSubTab === "main") {
      if (columnIndex === 1) {
        // Clicked CM column on the right
        const cmCohort = sortedCohorts.find((c: any) => c.study_year_id === 1 && c.cohort_name === "CM");
        if (cmCohort) slotCohortIds = [String(cmCohort.id)];
      } else {
        // Clicked CS column on the left: preselect Combined CS + CM
        slotCohortIds = sortedCohorts
          .filter((c: any) => c.study_year_id === 1)
          .map((c: any) => String(c.id));
      }
    } else {
      const targetCohortName = columns[columnIndex]?.cohort;
      const cohort = sortedCohorts.find(
        (c: any) => c.study_year_id === studyYearId && c.cohort_name === targetCohortName,
      );
      if (cohort) slotCohortIds = [String(cohort.id)];
    }

    setFormData({
      subject_id: "",
      instructor_id: "",
      room_id: "",
      cohort_ids: slotCohortIds,
      day: reverseDayMap[dayFull] || "MON",
      start_time: startTime,
      end_time: endTime,
    });
    setEditingId(null);
    setExtraYears({});
    setShowOtherYears(false);
    setIsModalOpen(true);
  };

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
          room_id: lesson.roomId,
          // Only this year's copy moves; other years sharing the class stay where they are
          detach: true,
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
    mutationFn: ({ id, data }: { id: string, data: Partial<typeof formData> & { detach?: boolean } }) =>
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
  const [freshmanSubTab, setFreshmanSubTab] = useState<FreshmanSubTab>("main");
  const [freshmanDropdownOpen, setFreshmanDropdownOpen] = useState(false);
  const freshmanBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click / tap
  useEffect(() => {
    if (!freshmanDropdownOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        freshmanBtnRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setFreshmanDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [freshmanDropdownOpen]);
  const activeColumns = yearColumns(academicYearToId[activeGroup], activeGroup === "Freshman" ? freshmanSubTab : undefined);

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
  }, [activeGroup, freshmanSubTab]);


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

    const merged: any[] = [];
    const seenGroups = new Set<string>();

    for (const lesson of allLessons.filter((l) => l.yearId === targetId)) {
      const members = lesson.shareGroup ? groups.get(lesson.shareGroup)! : [lesson];
      if (lesson.shareGroup) {
        if (seenGroups.has(lesson.shareGroup)) continue;
        seenGroups.add(lesson.shareGroup);
      }
      const here = members.filter((m) => m.yearId === targetId);

      const groupByYear: Record<number, string[]> = {};
      for (const m of members) (groupByYear[m.yearId] ??= []).push(String(m.cohortId));
      const otherYears = Object.keys(groupByYear).map(Number).filter((y) => y !== targetId)
        .sort((a, b) => a - b).map((y) => yearIdToLabel[y]).filter(Boolean);

      if (activeGroup === "Freshman") {
        const hereCohorts = here.map((m) => m.cohortName);

        if (freshmanSubTab === "main") {
          // On "Main", show if it includes CM (just CM or combined with CS cohorts)
          const hasCm = hereCohorts.some((c) => c.startsWith("CM"));
          const hasCs = hereCohorts.some((c) => c.startsWith("CS") || c === "POST_PREP");

          // Only classes with CM belong in Main (pure CS classes belong in CS A & B or Direct & Prep tabs)
          if (!hasCm) continue;

          // If combined with CS: spans both columns (starts at CS col 0, spans 2 cols across to CM)
          // If just CM: sits in the right column (col 1: CM, colSpan 1)
          const isCombinedCs = hasCs;

          merged.push({
            ...lesson,
            columnIndex: isCombinedCs ? 0 : 1,
            columnCount: 2,
            isCombined: isCombinedCs,
            combinedColumnStart: 0,
            combinedColumnSpan: isCombinedCs ? 2 : 1,
            cohortLabel: here.map((m) => formatCohortName(m.cohortName)).join(" + "),
            yearCohortIds: here.map((m) => String(m.cohortId)),
            groupByYear,
            otherYears,
          });
        } else if (freshmanSubTab === "cs_ab") {
          const cols = ["CS_A", "CS_B"];
          const matchingMembers = here.filter((m) => cols.includes(m.cohortName));
          if (matchingMembers.length === 0) continue;

          const colIndices = matchingMembers.map((m) => cols.indexOf(m.cohortName)).filter((i) => i >= 0);
          const colStart = Math.min(...colIndices);
          const colSpan = Math.max(...colIndices) - colStart + 1;

          merged.push({
            ...lesson,
            columnIndex: colStart,
            columnCount: 2,
            isCombined: matchingMembers.length > 1 || here.length > 1,
            combinedColumnStart: colStart,
            combinedColumnSpan: colSpan,
            cohortLabel: here.map((m) => formatCohortName(m.cohortName)).join(" + "),
            yearCohortIds: here.map((m) => String(m.cohortId)),
            groupByYear,
            otherYears,
          });
        } else if (freshmanSubTab === "cs_direct_prep") {
          const cols = ["CS_DIRECT", "POST_PREP"];
          const matchingMembers = here.filter((m) => cols.includes(m.cohortName));
          if (matchingMembers.length === 0) continue;

          const colIndices = matchingMembers.map((m) => cols.indexOf(m.cohortName)).filter((i) => i >= 0);
          const colStart = Math.min(...colIndices);
          const colSpan = Math.max(...colIndices) - colStart + 1;

          merged.push({
            ...lesson,
            columnIndex: colStart,
            columnCount: 2,
            isCombined: matchingMembers.length > 1 || here.length > 1,
            combinedColumnStart: colStart,
            combinedColumnSpan: colSpan,
            cohortLabel: here.map((m) => formatCohortName(m.cohortName)).join(" + "),
            yearCohortIds: here.map((m) => String(m.cohortId)),
            groupByYear,
            otherYears,
          });
        }
      } else {
        const cols = ["CS", "CM"];
        const colIndices = here.map((m) => {
          const idx = cols.indexOf(m.cohortName);
          return idx >= 0 ? idx : m.cohortName.startsWith("CM") ? 1 : 0;
        });
        const colStart = Math.min(...colIndices);
        const colSpan = Math.max(...colIndices) - colStart + 1;

        merged.push({
          ...lesson,
          columnIndex: colStart,
          columnCount: 2,
          isCombined: here.length > 1,
          combinedColumnStart: colStart,
          combinedColumnSpan: colSpan,
          cohortLabel: here.map((m) => formatCohortName(m.cohortName)).join(" + "),
          yearCohortIds: here.map((m) => String(m.cohortId)),
          groupByYear,
          otherYears,
        });
      }
    }
    return merged;
  }, [allLessons, activeGroup, freshmanSubTab]);



  return (
    <>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Lessons</h1>

        {/* --- NAVBAR --- */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {groups.map((group) => {
              if (group === "Freshman") {
                // Freshman button with dropdown
                const subTabLabels: Record<FreshmanSubTab, string> = {
                  main: "Main",
                  cs_ab: "CS A & CS B",
                  cs_direct_prep: "CS Direct & Post Prep",
                };
                const isActive = activeGroup === "Freshman";
                return (
                  <div key={group} className="relative">
                    <button
                      ref={freshmanBtnRef}
                      onClick={() => setFreshmanDropdownOpen((o) => !o)}
                      className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${isActive
                          ? "bg-primary text-white shadow-md"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      <span>Freshman</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${freshmanDropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {/* Dropdown menu */}
                    <div
                      ref={dropdownRef}
                      className={`absolute left-0 top-full mt-1.5 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-200 origin-top ${freshmanDropdownOpen
                          ? "opacity-100 scale-y-100 pointer-events-auto"
                          : "opacity-0 scale-y-0 pointer-events-none"
                        }`}
                      style={{ minWidth: freshmanBtnRef.current?.offsetWidth ?? "auto" }}
                    >
                      {(["main", "cs_ab", "cs_direct_prep"] as FreshmanSubTab[]).map(
                        (tab) => (
                          <button
                            key={tab}
                            onClick={() => {
                              setActiveGroup("Freshman");
                              setFreshmanSubTab(tab);
                              setFreshmanDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${freshmanSubTab === tab
                                ? "bg-slate-900 text-white"
                                : "text-slate-700 hover:bg-slate-100"
                              }`}
                          >
                            {subTabLabels[tab]}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                );
              }
              // Other year buttons
              return (
                <button
                  key={group}
                  onClick={() => {
                    setActiveGroup(group);
                    setFreshmanDropdownOpen(false);
                  }}
                  className={group === activeGroup
                    ? "rounded-full bg-primary px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white shadow-md"
                    : "rounded-full border border-slate-300 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"}
                >
                  {group}
                </button>
              );
            })}
          </div>
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
              <h2 className="text-xl font-bold mb-4">
                {activeGroup} Schedule {activeGroup === "Freshman" ? (freshmanSubTab === "main" ? "— Main" : freshmanSubTab === "cs_ab" ? "— CS A & CS B" : "— CS Direct & Post Prep") : ""}
              </h2>

              <div
                className="overflow-x-auto overflow-y-hidden border border-slate-200 bg-white rounded-2xl shadow-sm"
                onScroll={handleTableScroll}
              >
                <div style={{ minWidth: activeColumns.length === 3 ? 1695 : activeColumns.length === 1 ? 900 : 1252 }}>
                  {/* Header Days */}
                  <div
                    className={`grid ${isScrolledRight
                        ? "grid-cols-[32px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[34px_1fr_1fr_1fr_1fr_1fr]"
                        : "grid-cols-[48px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[65px_1fr_1fr_1fr_1fr_1fr]"
                      } border-b border-slate-200 bg-slate-50/80 transition-[grid-template-columns] duration-200`}
                  >
                    <div
                      className={`border-r border-slate-200 font-bold text-slate-400 flex items-center justify-center sticky left-0 z-20 bg-slate-50 transition-all duration-200 ${isScrolledRight ? "text-[6.5px] px-[1px] py-1" : "text-[7.5px] sm:text-[8px] p-1 sm:p-2.5"
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
                    className={`grid ${isScrolledRight
                        ? "grid-cols-[32px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[34px_1fr_1fr_1fr_1fr_1fr]"
                        : "grid-cols-[48px_1fr_1fr_1fr_1fr_1fr] sm:grid-cols-[65px_1fr_1fr_1fr_1fr_1fr]"
                      } relative h-[763px] bg-white transition-[grid-template-columns] duration-200`}
                  >
                    {/* Time Axis */}
                    <div className="border-r border-slate-200 bg-slate-50 sticky left-0 z-20 transition-all duration-200 shadow-[1px_0_3px_rgba(0,0,0,0.04)]">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div
                          key={i}
                          className={`absolute w-full text-[9px] text-slate-400 font-bold ${isScrolledRight ? "pr-[3px]" : "pr-2"
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

                {/* Cohort Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Cohorts ({activeGroup})
                    </label>
                    {/* Quick selection pills for Freshman */}
                    {activeGroup === "Freshman" && (
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const ids = sortedCohorts
                              .filter((c: any) => c.study_year_id === 1 && c.cohort_name === "CM")
                              .map((c: any) => String(c.id));
                            setFormData({ ...formData, cohort_ids: ids });
                          }}
                          className={`px-1.5 py-0.5 rounded font-medium transition ${formData.cohort_ids.length === 1 &&
                              sortedCohorts.find((c: any) => String(c.id) === formData.cohort_ids[0])?.cohort_name === "CM"
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                        >
                          Just CM
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ids = sortedCohorts
                              .filter((c: any) => c.study_year_id === 1)
                              .map((c: any) => String(c.id));
                            setFormData({ ...formData, cohort_ids: ids });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          All (CS + CM)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ids = sortedCohorts
                              .filter((c: any) => c.study_year_id === 1 && ["CS_A", "CS_B"].includes(c.cohort_name))
                              .map((c: any) => String(c.id));
                            setFormData({ ...formData, cohort_ids: ids });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          CS A & B
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ids = sortedCohorts
                              .filter((c: any) => c.study_year_id === 1 && ["CS_DIRECT", "POST_PREP"].includes(c.cohort_name))
                              .map((c: any) => String(c.id));
                            setFormData({ ...formData, cohort_ids: ids });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          Direct & Prep
                        </button>
                      </div>
                    )}
                    {activeGroup !== "Freshman" && (
                      <div className="flex gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const targetYearId = academicYearToId[activeGroup];
                            const ids = sortedCohorts
                              .filter((c: any) => c.study_year_id === targetYearId)
                              .map((c: any) => String(c.id));
                            setFormData({ ...formData, cohort_ids: ids });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                        >
                          Both CS & CM
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cohort Checkboxes */}
                  <div className="flex flex-wrap gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    {(() => {
                      const targetYearId = academicYearToId[activeGroup];
                      const allowedCohorts = allYearCohorts(targetYearId).map((c) => c.cohort);
                      const available = sortedCohorts.filter(
                        (c: any) => c.study_year_id === targetYearId && allowedCohorts.includes(c.cohort_name)
                      );

                      return available.map((c: any) => {
                        const isChecked = formData.cohort_ids.includes(String(c.id));
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition border ${isChecked
                                ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              checked={isChecked}
                              onChange={(e) => {
                                const idStr = String(c.id);
                                const newIds = e.target.checked
                                  ? [...formData.cohort_ids, idStr]
                                  : formData.cohort_ids.filter((id) => id !== idStr);
                                setFormData({ ...formData, cohort_ids: newIds });
                              }}
                            />
                            {formatCohortName(c.cohort_name)}
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Other study years taking the same class; each year picks its own cohorts */}
                <div className="rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowOtherYears(!showOtherYears)}
                    aria-expanded={showOtherYears}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 uppercase"
                  >
                    <span>
                      Share with other study years
                      {Object.keys(extraYears).length > 0 && (
                        <span className="ml-1 normal-case font-semibold text-indigo-600">
                          ({Object.keys(extraYears).map((y) => yearIdToLabel[Number(y)]).join(", ")})
                        </span>
                      )}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showOtherYears ? "rotate-180" : ""}`} />
                  </button>

                  {showOtherYears && (
                    <div className="space-y-2 border-t border-slate-200 p-2.5">
                      {groups.filter((g) => g !== activeGroup).map((g) => {
                        const yearId = academicYearToId[g];
                        const picked = extraYears[yearId];
                        return (
                          <div key={g} className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={picked !== undefined}
                                onChange={(e) => {
                                  const next = { ...extraYears };
                                  if (e.target.checked) next[yearId] = [];
                                  else delete next[yearId];
                                  setExtraYears(next);
                                }}
                              />
                              {g}
                            </label>
                            {picked !== undefined && (
                              <div className="flex flex-wrap gap-2 pl-5">
                                {yearCohortOptions(yearId).map((c: any) => {
                                  const idStr = String(c.id);
                                  const isChecked = picked.includes(idStr);
                                  return (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition border ${isChecked
                                          ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                        }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                        checked={isChecked}
                                        onChange={(e) =>
                                          setExtraYears({
                                            ...extraYears,
                                            [yearId]: e.target.checked
                                              ? [...picked, idStr]
                                              : picked.filter((id) => id !== idStr),
                                          })
                                        }
                                      />
                                      {formatCohortName(c.cohort_name)}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-slate-400">
                        Tick a year, then pick its cohorts. Each year can be CS, CM or both.
                      </p>
                    </div>
                  )}
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
  const durationMins = endMins - startMins;
  const isCompact = durationMins <= 45;
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
      <div className={`flex items-baseline gap-1 ${isCompact ? "text-[7px]" : "text-[9px]"} font-bold leading-tight`}>
        <span className="min-w-0 truncate">{lesson.title}</span>
        {lesson.isCombined && (
          <span className="shrink-0 font-semibold opacity-70">({lesson.cohortLabel})</span>
        )}
      </div>
      {lesson.otherYears?.length > 0 && (
        <div className={`${isCompact ? "text-[6.5px]" : "text-[8px]"} font-semibold truncate leading-tight`}>Shared with: {lesson.otherYears.join(", ")}</div>
      )}
      <div className={`${isCompact ? "text-[6.5px]" : "text-[8px]"} font-medium leading-tight`}>{effectiveStart}-{effectiveEnd}</div>
      <div className={`${isCompact ? "text-[6.5px]" : "text-[8px]"} font-medium truncate leading-tight`}>{lesson.instructor}</div>
      <div className={`${isCompact ? "text-[6.5px]" : "text-[8px]"} font-bold ${isCompact ? "" : "mt-0.5"} uppercase leading-tight ${isShared ? "text-purple-900" : "text-indigo-900"}`}>{lesson.room}</div>

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
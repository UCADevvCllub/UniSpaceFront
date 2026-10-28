import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const reverseDayMap: Record<string, string> = {
  'MONDAY': 'MON', 'TUESDAY': 'TUE', 'WEDNESDAY': 'WED',
  'THURSDAY': 'THU', 'FRIDAY': 'FRI'
};


export const FRESHMAN_YEAR_ID = 1;

/** @deprecated kept as alias for backward compat — use FreshmanToggles instead */
export type FreshmanSubTab = "main" | "cs_ab" | "cs_direct_prep";

export type CsSection = "CS_A" | "CS_B";
export type CsTrack = "CS_DIRECT" | "POST_PREP";
export interface FreshmanToggles {
  section: CsSection;
  track: CsTrack;
}

// The sub-columns inside each day column:
// For Freshman: one combined column for the selected CS section + track, and CM.
// For other years: CS | CM.
export function yearColumns(
  yearId: number,
  _subTabLegacy?: FreshmanSubTab,
  toggles?: FreshmanToggles,
): { label: string; cohort: string }[] {
  if (yearId === FRESHMAN_YEAR_ID) {
    if (toggles) {
      const sectionLabel = toggles.section === "CS_A" ? "CS A" : "CS B";
      const trackLabel = toggles.track === "CS_DIRECT" ? "Direct" : "Post Prep";
      return [
        { label: `${sectionLabel} + ${trackLabel}`, cohort: `${toggles.section}__${toggles.track}` },
        { label: "CM", cohort: "CM" },
      ];
    }
    // Legacy fallback
    return [
      { label: "CS", cohort: "CS" },
      { label: "CM", cohort: "CM" },
    ];
  }

  return [
    { label: "CS", cohort: "CS" },
    { label: "CM", cohort: "CM" },
  ];
}

// All legitimate cohorts belonging to a year (used for admin selection, forms, labels)
export function allYearCohorts(yearId: number): { label: string; cohort: string }[] {
  if (yearId === FRESHMAN_YEAR_ID) {
    return [
      { label: "CS A", cohort: "CS_A" },
      { label: "CS B", cohort: "CS_B" },
      { label: "CS Direct", cohort: "CS_DIRECT" },
      { label: "Post Prep", cohort: "POST_PREP" },
      { label: "CM", cohort: "CM" },
      { label: "CM Direct", cohort: "CM_DIRECT" },
    ];
  }

  return [
    { label: "CS", cohort: "CS" },
    { label: "CM", cohort: "CM" },
  ];
}

export function formatCohortName(cohortName: string): string {
  if (cohortName === "CS_DIRECT") return "CS Direct";
  if (cohortName === "POST_PREP") return "Post Prep";
  if (cohortName === "CS_A") return "CS A";
  if (cohortName === "CS_B") return "CS B";
  if (cohortName === "CM_DIRECT") return "CM Direct";
  return cohortName.replace("_", " ");
}

export function mapDjangoToUi(djangoEvents: any[]): any[] {
  const dayMap: any = { 'MON': 'MONDAY', 'TUE': 'TUESDAY', 'WED': 'WEDNESDAY', 'THU': 'THURSDAY', 'FRI': 'FRIDAY' };

  return djangoEvents.map((ce) => {
    const yearId = ce.cohort_detail?.study_year_id;
    const cohortName: string = ce.cohort_detail?.cohort_name ?? "";

    return {
      id: ce.id.toString(),
      day: dayMap[ce.event_detail?.day] || 'MONDAY',
      startTime: ce.event_detail?.start_time?.slice(0, 5) ?? "00:00",
      endTime: ce.event_detail?.end_time?.slice(0, 5) ?? "00:00",
      title: ce.subject_detail?.name ?? "No Title",
      instructor: ce.instructor_detail ? `${ce.instructor_detail.first_name} ${ce.instructor_detail.last_name}` : "TBD",
      room: ce.room_detail?.room_number ?? "TBD",
      cohortName,
      formattedCohort: formatCohortName(cohortName),
      yearId,

      // Raw data
      subjectId: ce.subject_id,
      instructorId: ce.instructor_id,
      roomId: ce.room_id,
      cohortId: ce.cohort_id,
      // Lessons sharing a shareGroup are one class taught to several cohorts/years
      shareGroup: ce.share_group ?? null,
      subCategory: ce.sub_category ?? null
    };
  });
}
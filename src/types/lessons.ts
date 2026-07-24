export type FreshmanLesson = {
    id: string;
    day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
    cohort: string; 
    startTime: string; 
    endTime: string;   
    title: string;
    instructor: string;
    room: string;
    studyYearId?: number; // The ID from Django's StudyYear table
  };
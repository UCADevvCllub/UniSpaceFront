export type Exam = {
  subject: string;
  roomsAndInstructors: string[];
  time: string;
  notes?: string;
  color?: string;
};

export type FinalExamRow = {
  cohort: string;
  rowBg: string;
  cohortBg: string;
  cohortText: string;
  monday: Exam[];
  tuesday: Exam[];
  wednesday: Exam[];
  thursday: Exam[];
  friday: Exam[];
};

export const finalExamsSchedule: FinalExamRow[] = [
  {
    cohort: "Preparatory",
    rowBg: "bg-blue-50/30 hover:bg-blue-50/60",
    cohortBg: "bg-blue-100/50 border-l-4 border-l-blue-400",
    cohortText: "text-blue-900",
    monday: [],
    tuesday: [],
    wednesday: [
      { subject: "Precalculus", roomsAndInstructors: ["Room 209: Azmat Hussain", "Room 204: Meerim Tursunalieva"], time: "10:30 - 12:00" }
    ],
    thursday: [],
    friday: [
      { subject: "Scientific Inquiry: Beyond the Visible", roomsAndInstructors: ["Room 202: Roza Kazakbaeva", "Room 204: Gulnura Zholdoshbekova"], time: "14:00 - 16:00" }
    ]
  },
  {
    cohort: "Freshman Arts",
    rowBg: "bg-rose-50/30 hover:bg-rose-50/60",
    cohortBg: "bg-rose-100/50 border-l-4 border-l-rose-400",
    cohortText: "text-rose-900",
    monday: [
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "15:00 - 16:00" }
    ],
    tuesday: [
      { subject: "Sociology", roomsAndInstructors: ["Room 204: Nursultan Stanaliev", "Room 209: Bernard Musyck"], time: "14:00 - 15:30" }
    ],
    wednesday: [
      { subject: "Geography", roomsAndInstructors: ["Room 209: Nursultan Stanaliev", "Room 203: Fariza Sheralieva"], time: "09:00 - 10:30" },
      { subject: "Kyrgyz language Beginner", roomsAndInstructors: ["Room 203: Siren Kerimbaeva"], time: "14:00 - 15:30" },
      { subject: "Kyrgyz Language Elementary", roomsAndInstructors: ["Room 204: Azmat Hussain", "Room 202: Fariza Sheralieva"], time: "14:00 - 15:30" },
      { subject: "Kyrgyz Language Intermediate", roomsAndInstructors: ["Room 209: Roza Kazakbaeva"], time: "14:00 - 15:30" }
    ],
    thursday: [],
    friday: [
      { subject: "English Writing in Media", roomsAndInstructors: ["Room 209: Levi Bridge"], time: "13:30 - 16:30" }
    ]
  },
  {
    cohort: "Freshman Science",
    rowBg: "bg-emerald-50/30 hover:bg-emerald-50/60",
    cohortBg: "bg-emerald-100/50 border-l-4 border-l-emerald-400",
    cohortText: "text-emerald-900",
    monday: [
      { subject: "Calculus-II", roomsAndInstructors: ["Room 204: Zohirbek Asanshoev", "Room 209: Sajjad Akbar"], time: "14:00 - 16:00" },
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "16:00 - 17:00" }
    ],
    tuesday: [
      { subject: "Sociology", roomsAndInstructors: ["Room 204: Nursultan Stanaliev", "Room 209: Bernard Musyck"], time: "14:00 - 15:30" }
    ],
    wednesday: [
      { subject: "Geography", roomsAndInstructors: ["Room 209: Nursultan Stanaliev", "Room 203: Fariza Sheralieva"], time: "09:00 - 10:30" },
      { subject: "Kyrgyz language Beginner", roomsAndInstructors: ["Room 203: Siren Kerimbaeva"], time: "14:00 - 15:30" },
      { subject: "Kyrgyz Language Elementary", roomsAndInstructors: ["Room 204: Azmat Hussain", "Room 202: Fariza Sheralieva"], time: "14:00 - 15:30" },
      { subject: "Kyrgyz Language Intermediate", roomsAndInstructors: ["Room 209: Roza Kazakbaeva"], time: "14:00 - 15:30" }
    ],
    thursday: [
      { subject: "Physics-II", roomsAndInstructors: ["Room 209: Ahmed Attique", "Room 206: Muhammad Fayaz"], time: "10:00 - 12:30" }
    ],
    friday: [
      { subject: "Programming II", roomsAndInstructors: ["Room 206: Muhammad Fayaz", "Room 203: Sajjad Akbar"], time: "11:00 - 13:00", notes: "Moodle Safe Browsers Based Exam" }
    ]
  },
  {
    cohort: "Sophomore Arts",
    rowBg: "bg-amber-50/30 hover:bg-amber-50/60",
    cohortBg: "bg-amber-100/50 border-l-4 border-l-amber-400",
    cohortText: "text-amber-900",
    monday: [],
    tuesday: [
      { subject: "Statistics", roomsAndInstructors: ["Room 204: Azmat Hussain", "Room 203: Ian Canlas"], time: "09:00 - 10:30" },
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "15:00 - 16:00" }
    ],
    wednesday: [
      { subject: "Geography", roomsAndInstructors: ["Room 204: Amrisho Lashkariev", "Room 206: Bernard Musyck"], time: "09:00 - 10:30" }
    ],
    thursday: [
      { subject: "State exam", roomsAndInstructors: ["Room 202: Mukaram Toktogulova", "Room 204: Meerim Tursunalieva", "Room 203: Amrisho Lashkariev"], time: "09:00 - 12:00", color: "text-red-600 font-bold" }
    ],
    friday: [
      { subject: "Media Production Audio", roomsAndInstructors: ["Creative studio: Levi Bridge"], time: "09:00 - 12:00" }
    ]
  },
  {
    cohort: "Sophomore Science",
    rowBg: "bg-teal-50/30 hover:bg-teal-50/60",
    cohortBg: "bg-teal-100/50 border-l-4 border-l-teal-400",
    cohortText: "text-teal-900",
    monday: [
      { subject: "Data Structure & Algorithms", roomsAndInstructors: ["Room 203: Zohirbek Asanshoev", "Room 204: Sajjad Akbar"], time: "11:00 - 12:30" }
    ],
    tuesday: [
      { subject: "Linear Algebra", roomsAndInstructors: ["Room 204: Siren Kerimbaeva", "Room 203: Fariza Sheralieva"], time: "10:30 - 12:30" },
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "15:00 - 16:00" }
    ],
    wednesday: [
      { subject: "Geography", roomsAndInstructors: ["Room 204: Amrisho Lashkariev", "Room 206: Bernard Musyck"], time: "09:00 - 10:30" }
    ],
    thursday: [
      { subject: "State exam", roomsAndInstructors: ["Room 202: Mukaram Toktogulova", "Room 204: Meerim Tursunalieva", "Room 203: Amrisho Lashkariev"], time: "09:00 - 12:00", color: "text-red-600 font-bold" }
    ],
    friday: [
      { subject: "Digital Logic & Design", roomsAndInstructors: ["Rooms 209: Ahmed Attique", "Rooms 206: Ian Canlas"], time: "16:30 - 18:00" }
    ]
  },
  {
    cohort: "Junior Arts",
    rowBg: "bg-purple-50/30 hover:bg-purple-50/60",
    cohortBg: "bg-purple-100/50 border-l-4 border-l-purple-400",
    cohortText: "text-purple-900",
    monday: [],
    tuesday: [
      { subject: "Introduction to Computer Science", roomsAndInstructors: ["Room 209: Ahmed Attique", "Room 206: Meerim Tursunalieva"], time: "10:00 - 12:00" }
    ],
    wednesday: [
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "15:00 - 16:00" }
    ],
    thursday: [],
    friday: []
  },
  {
    cohort: "Junior Science",
    rowBg: "bg-sky-50/30 hover:bg-sky-50/60",
    cohortBg: "bg-sky-100/50 border-l-4 border-l-sky-400",
    cohortText: "text-sky-900",
    monday: [
      { subject: "Local Development & Digital Transformation (Elective)", roomsAndInstructors: ["Room 209: Bernard Musyck"], time: "09:00 - 12:00", notes: "Project presentation" }
    ],
    tuesday: [
      { subject: "Introduction to Computer Science", roomsAndInstructors: ["Room 209: Ahmed Attique", "Room 206: Meerim Tursunalieva"], time: "10:00 - 12:00" }
    ],
    wednesday: [
      { subject: "Operating Systems and System Programming", roomsAndInstructors: ["Room 111: Siren Kerimbaeva"], time: "10:00 - 11:30" },
      { subject: "Physical Education", roomsAndInstructors: ["Gym"], time: "15:00 - 16:00" }
    ],
    thursday: [
      { subject: "Machine Learning", roomsAndInstructors: ["Room 209: Roza Kazakbaeva", "Room 206: Dmytro Zubov"], time: "14:00 - 15:30" }
    ],
    friday: []
  },
  {
    cohort: "Senior Arts",
    rowBg: "bg-pink-50/30 hover:bg-pink-50/60",
    cohortBg: "bg-pink-100/50 border-l-4 border-l-pink-400",
    cohortText: "text-pink-900",
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  },
  {
    cohort: "Senior Science",
    rowBg: "bg-indigo-50/30 hover:bg-indigo-50/60",
    cohortBg: "bg-indigo-100/50 border-l-4 border-l-indigo-400",
    cohortText: "text-indigo-900",
    monday: [],
    tuesday: [
      { subject: "Internet of Things", roomsAndInstructors: ["Hardware lab: Dmytro Zubov"], time: "11:00 - 12:30" }
    ],
    wednesday: [],
    thursday: [
      { subject: "Cyber Security", roomsAndInstructors: ["Room 209: Dmytro Zubov", "Room 206: Muhammad Fayaz"], time: "16:30 - 18:00" }
    ],
    friday: []
  }
];

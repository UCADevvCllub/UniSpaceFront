"use client";
import axios from "axios";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchClassEvents } from "@/lib/events";
import { mapDjangoToUi, formatEventTime } from "@/lib/utils";
import { finalExamsSchedule } from "./final-exams-data";
import { useEvents } from "@/hooks/use-events";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteClassEvent } from "@/lib/events";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";

import { 
  fetchEvents, 
  fetchSubjects, 
  fetchInstructors, 
  fetchRooms, 
  fetchCohorts 
} from "@/lib/events";
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


  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: instructors } = useQuery({ queryKey: ["instructors"], queryFn: fetchInstructors });
  const { data: rooms } = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const { data: cohorts } = useQuery({ queryKey: ["cohorts"], queryFn: fetchCohorts });
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
          start_time: newData.start_time + ":00", // Django wants HH:MM:SS
          end_time: newData.end_time + ":00",
          status: "CLASS"
        }
      };
    return axios.post(`${process.env.NEXT_PUBLIC_API_LOCAL}/api/class-events/`, payload);
    },


    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["django-class-events"] });
      setIsModalOpen(false);
      alert("Lesson created!");
    },
    onError: (error: any) => {
  
      const serverError = error.response?.data;
      alert("Error: " + JSON.stringify(serverError));
    }
  });

// delete button
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClassEvent(id),
  onSuccess: () => {
    // re-fetch the list from Django
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
        <Button 
    onClick={() => setIsModalOpen(true)}
    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
  >
    <span className="text-lg">+</span> Add Lesson
  </Button>
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
                        <div key={lesson.id} className="absolute p-2 rounded border-l-4 shadow-sm bg-indigo-50 border-indigo-200 border-l-indigo-500 text-indigo-700 z-10 group hover:z-20 transition-all" style={{ top: `${top}%`, height: `${height}%`, left, width: '50%' }}>
                          <div className="text-[10px] font-bold truncate">{lesson.title}</div>
                          <div className="text-[9px] font-medium">{lesson.startTime}-{lesson.endTime}</div>
                          <div className="text-[9px] font-bold mt-1 uppercase text-indigo-900">{lesson.room}</div>
                          {/* here */}
                          {/* {isAdmin && ( */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); 
                              handleDelete(lesson.id);
                            }}
                            className="absolute top-1 right-1 p-1 text-indigo-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                       
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
   
    {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
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
                  {cohorts?.map((c: any) => <option key={c.id} value={c.id}>{c.cohort_name} (Year: {c.study_year_id})</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
                className="bg-indigo-600 text-white"
              >
                {createMutation.isPending ? "Saving..." : "Save Lesson"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
    
  );
}
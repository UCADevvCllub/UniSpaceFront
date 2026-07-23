"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useEvents } from "@/hooks/use-events";
import { createBooking, updateBooking } from "@/lib/bookings";
import { deleteScheduleEvent } from "@/lib/admin-events";
import { CampusEvent } from "@/types/event";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LOUNGES = ["A1 TV lounge", "A2 TV lounge", "B1 TV lounge", "B2 TV lounge"];

export default function BookingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    location: LOUNGES[0],
    date: "",
    startTime: "",
    endTime: "",
    name: "",
    whatsapp: "",
  });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  // Fetch all bookings
  const bookingsQuery = useEvents({ type: "booking" });
  const allBookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);

  // Auto-erase expired bookings
  useEffect(() => {
    if (!allBookings.length) return;
    const interval = setInterval(async () => {
      const now = new Date();
      const expired = allBookings.filter(b => b.end.toDate() < now);
      if (expired.length > 0) {
        for (const booking of expired) {
          await deleteScheduleEvent(booking.id).catch(console.error);
        }
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [allBookings, queryClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!form.date || !form.startTime || !form.endTime || !form.name || !form.whatsapp) {
      setStatus("Please fill in all fields.");
      return;
    }

    const startDateTime = new Date(`${form.date}T${form.startTime}`);
    const endDateTime = new Date(`${form.date}T${form.endTime}`);
    const now = new Date();

    if (startDateTime < now) {
      setStatus("Cannot book past dates or times.");
      return;
    }

    if (endDateTime <= startDateTime) {
      setStatus("End time must be after start time.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBookingId) {
        await updateBooking(editingBookingId, {
          title: `Booked by ${form.name}`,
          location: form.location,
          group: "Booking",
          start: startDateTime,
          end: endDateTime,
          description: "",
          bookedBy: form.name,
          whatsapp: form.whatsapp,
        });
        setStatus("Booking updated successfully!");
        setEditingBookingId(null);
      } else {
        await createBooking({
          title: `Booked by ${form.name}`,
          location: form.location,
          group: "Booking",
          start: startDateTime,
          end: endDateTime,
          description: "",
          bookedBy: form.name,
          whatsapp: form.whatsapp,
        }, user?.id?.toString());
        setStatus("Booking successful!");
      }
      setForm({
        ...form,
        startTime: "",
        endTime: "",
        name: "",
        whatsapp: "",
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (booking: CampusEvent) => {
    const start = booking.start.toDate();
    const end = booking.end.toDate();
    
    // Convert to YYYY-MM-DD
    const dateStr = start.toLocaleDateString('en-CA');
    
    // Convert to HH:MM format
    const startStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const endStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    setForm({
      location: booking.location,
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      name: booking.bookedBy || booking.title.replace("Booked by ", ""),
      whatsapp: booking.whatsapp || "",
    });
    setEditingBookingId(booking.id);
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to delete this booking?")) return;
    try {
      await deleteScheduleEvent(bookingId);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (editingBookingId === bookingId) {
        setEditingBookingId(null);
        setForm({...form, startTime: "", endTime: "", name: "", whatsapp: ""});
      }
    } catch (error) {
      console.error(error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Not available yet</h2>
        <p className="text-slate-500 mt-2">The booking feature is coming soon.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Booking</h1>
        <p className="text-slate-600 mt-1">Reserve TV Lounges across the campus.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Card className="p-6 border-slate-200 shadow-sm bg-white sticky top-6">
            <h2 className="text-xl font-semibold mb-5 text-slate-800">
              {editingBookingId ? "Edit Booking" : "New Booking"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Place</label>
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                >
                  {LOUNGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">From</label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">To</label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Asiljon Mamajonov"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +992 98 865 2006"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                  value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                />
              </div>

              {status && (
                <div className={`p-4 rounded-xl text-sm font-medium mt-6 ${status.includes("success") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                  {status}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1 py-6 text-base font-semibold">
                  {isSubmitting ? "Saving..." : editingBookingId ? "Update Booking" : "Book Now"}
                </Button>
                {editingBookingId && (
                  <Button type="button" variant="outline" className="py-6" onClick={() => {
                    setEditingBookingId(null);
                    setForm({...form, startTime: "", endTime: "", name: "", whatsapp: ""});
                    setStatus("");
                  }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">Upcoming Bookings</h2>
          {allBookings.length === 0 ? (
            <Card className="p-8 border-slate-200 border-dashed bg-slate-50 text-center flex flex-col items-center justify-center min-h-[200px]">
              <p className="text-slate-500 font-medium text-lg">No upcoming bookings yet.</p>
              <p className="text-slate-400 text-sm mt-1">Be the first to reserve a lounge!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {allBookings.sort((a, b) => a.start.toMillis() - b.start.toMillis()).map(booking => {
                const s = booking.start.toDate();
                const e = booking.end.toDate();
                return (
                  <Card key={booking.id} className="p-5 border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{booking.location}</h3>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{formatDate(s)}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-100">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(s)} - {formatTime(e)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100/80 text-sm flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
                        <p className="flex items-center text-slate-600">
                          <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-semibold text-slate-800">{booking.bookedBy || booking.title}</span>
                        </p>
                        {booking.whatsapp && (
                          <p className="flex items-center text-slate-600">
                            <svg className="w-4 h-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="font-semibold text-slate-800">{booking.whatsapp}</span>
                          </p>
                        )}
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                          <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => handleEdit(booking)}>Edit</Button>
                          <Button variant="outline" className="h-8 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(booking.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

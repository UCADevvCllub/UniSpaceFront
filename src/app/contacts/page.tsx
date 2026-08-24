"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { fetchContacts } from "@/lib/events";
import { createContact, deleteContact } from "@/lib/admin-events";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function ContactsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"onCampus" | "offCampus">("onCampus");
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
  });

  const contactsQuery = useQuery({
    queryKey: ["django-contacts"],
    queryFn: fetchContacts,
  });
  const locationMap = { onCampus: "ON_CAMPUS", offCampus: "OFF_CAMPUS" };
  const contacts = (contactsQuery.data ?? []).filter(
    (contact: any) => contact.location === locationMap[activeTab]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");
    if (!form.name || !form.phone) {
      setStatus("Name and Contact number are mandatory.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createContact({
        full_name: form.name,
        role: form.role,
        phone_number: form.phone,
        location: locationMap[activeTab],
      });
      await queryClient.invalidateQueries({ queryKey: ["django-contacts"] });
      setForm({ name: "", role: "", phone: "" });
      setIsAdding(false);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to add contact.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    try {
      await deleteContact(id);
      await queryClient.invalidateQueries({ queryKey: ["django-contacts"] });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
          <p className="text-slate-600 mt-1">Important numbers for on-campus and off-campus services.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAdding(!isAdding)} variant="outline">
            {isAdding ? "Cancel" : "Add Contact"}
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => {
            setActiveTab("onCampus");
            setIsAdding(false);
            setStatus("");
          }}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "onCampus"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          On Campus
        </button>
        <button
          onClick={() => {
            setActiveTab("offCampus");
            setIsAdding(false);
            setStatus("");
          }}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "offCampus"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Off Campus
        </button>
      </div>

      {isAdding && isAdmin && (
        <Card className="p-6 border-slate-200 shadow-sm bg-white mb-6 animate-in slide-in-from-top-2 fade-in duration-200">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Add New Contact ({activeTab === "onCampus" ? "On Campus" : "Off Campus"})</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role (optional)</label>
              <input
                type="text"
                placeholder="e.g. Emergency & Safety"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name (mandatory)</label>
              <input
                type="text"
                placeholder="e.g. Campus Security"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact number (mandatory)</label>
              <input
                type="tel"
                placeholder="e.g. +992 93 123 4567"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:bg-white transition-colors"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            {status && (
              <div className="p-3 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200">
                {status}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="py-6 text-base font-semibold w-full sm:w-auto mt-2">
              {isSubmitting ? "Saving..." : "Save Contact"}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact: any) => (
          <Card key={contact.id} className="p-5 border-slate-200 hover:shadow-md transition-shadow bg-white relative group">
            {isAdmin && (
              <Button
                variant="outline"
                className="absolute top-3 right-3 h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(contact.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <h3 className="font-bold text-lg text-slate-900 pr-8">{contact.full_name}</h3>
            {contact.role && <p className="text-sm font-medium text-indigo-600 mb-4">{contact.role}</p>}

            <div className="space-y-2.5 text-sm mt-3">
              {contact.phone_number && (
                <div className="flex items-center text-slate-700">
                  <PhoneCall className="w-4 h-4 mr-2.5 text-slate-400" />
                  <a href={`tel:${contact.phone_number.replace(/[^0-9+]/g, '')}`} className="hover:text-indigo-600 transition-colors">
                    {contact.phone_number}
                  </a>
                </div>
              )}
            </div>
          </Card>
        ))}
        {contacts.length === 0 && !contactsQuery.isLoading && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
            No contacts available yet. {isAdmin ? "Click 'Add Contact' to create one." : ""}
          </div>
        )}
      </div>
    </section>
  );
}

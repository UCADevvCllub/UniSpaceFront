"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export default function ProfilePage() {
  const { user, classYear, isAdmin } = useAuth();

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Profile</h1>
      <Card>
        <p className="text-sm text-slate-600">Email</p>
        <p className="font-medium">{user?.email ?? "Not signed in"}</p>
        <p className="mt-3 text-sm text-slate-600">Class Year</p>
        <p className="font-medium">{classYear}</p>
        <p className="mt-3 text-sm text-slate-600">Role</p>
        <p className="font-medium">{isAdmin ? "Admin" : "Student"}</p>
      </Card>
    </section>
  );
}

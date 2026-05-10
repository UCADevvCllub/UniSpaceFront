import { cert, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : null;

if (!serviceAccount) {
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON with your service account JSON.");
}

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const eventsRef = db.collection("events");

const now = new Date();
const lessons = Array.from({ length: 10 }).map((_, index) => {
  const dayOffset = index % 5;
  const start = new Date(now);
  start.setDate(now.getDate() + dayOffset);
  start.setHours(9 + (index % 3) * 2, 0, 0, 0);

  const end = new Date(start);
  end.setHours(start.getHours() + 1, 30, 0, 0);

  return {
    title: `Sample Lesson ${index + 1}`,
    type: "lesson",
    location: "Room 201",
    group: "Class of 2027",
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    description: "Generated sample lesson",
  };
});

const canteenItems = [
  "Breakfast: Oatmeal and tea",
  "Lunch: Plov and salad",
  "Snack: Samsa",
  "Dinner: Noodles and chicken",
  "Late menu: Soup and bread",
].map((description, index) => {
  const start = new Date(now);
  start.setDate(now.getDate() + index);
  start.setHours(8, 0, 0, 0);

  const end = new Date(start);
  end.setHours(22, 0, 0, 0);

  return {
    title: "Canteen Menu",
    type: "facility",
    location: "Canteen",
    group: "All Students",
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    description,
  };
});

for (const event of [...lessons, ...canteenItems]) {
  await eventsRef.add(event);
}

console.log("Seeded 10 lessons and 5 canteen items.");

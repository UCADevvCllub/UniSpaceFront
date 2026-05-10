# UCA Campus Hub

Mobile-first student dashboard for UCA built with Next.js App Router, Tailwind, and Firebase.

## Features

- Unified `events` collection (`lesson`, `facility`, `booking`)
- Home dashboard with "Right Now", Canteen, and Gym cards
- Smart schedule filters for year, classrooms, and facilities
- Empty room finder based on live lesson schedule
- TV Lounge slot picker with transaction-based conflict protection
- Google Auth restricted to `@uca.centralasia.org`

## Setup

1. Copy `.env.example` to `.env.local` and add Firebase web config values.
   - Add `NEXT_PUBLIC_ADMIN_EMAILS` with comma-separated admin UCA emails.
2. Install dependencies:
   - `npm install`
3. Run dev server:
   - `npm run dev`

## Firestore Rules

Deploy `firestore.rules`. It allows UCA users to read events, admin users to create/edit/delete lesson and facility schedules, and regular users to create/edit booking events they own (`createdBy == auth.uid`).

## Seed Script

Seed script is in `scripts/seed-firestore.mjs`:

1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` as an environment variable with full JSON string.
2. Run:
   - `node scripts/seed-firestore.mjs`

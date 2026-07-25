# Utsav Mitra

Friend-circle event manager for Ganpati Utsav, birthday parties, picnics, and any group function.
Built with React + Vite + Tailwind + Firebase + Capacitor (Android).

## Features (v1)
- Email/password auth — first signup becomes Super Admin; members self-signup then get added to events.
- Event templates: preset Ganpati (auto-seeds puja tasks + shopping) and a shared custom template library (notepad editor).
- Modules per event: Expenses (equal/custom split + minimal-cash-flow settlement), Tasks (Kanban + status dropdown), Shopping list, Notices, Gallery (receipt/photo upload), Members/roles.
- Role-based financial visibility: owner / treasurer / superAdmin see budget + settlement; plain members see only their own tasks/contributions.
- Strict Firestore + Storage security rules: members only see events they're added to.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill Firebase web config (Firebase console → Project settings).
3. `npm run dev` for web.
4. `npm run build && npx cap sync android` then open `android/` in Android Studio to build the APK.

## Firebase
- Enable Email/Password auth.
- Deploy `src/rules/firestore.rules` (Firestore rules).
- Storage rules: restrict `events/{eventId}/**` to event members (mirror the Firestore membership check).

## Deferred (v2)
FCM push, i18n (Hindi/English), polls/voting, meeting minutes, auto-recurring events.

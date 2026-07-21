import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Home from "@/pages/Home";

const EventLayout = lazy(() => import("@/pages/EventLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Shopping = lazy(() => import("@/pages/Shopping"));
const Notices = lazy(() => import("@/pages/Notices"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const Members = lazy(() => import("@/pages/Members"));
const Templates = lazy(() => import("@/pages/Templates"));

function LoadingScreen() {
  return (
    <div className="grid h-screen place-items-center bg-background text-text">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-text-dim">Loading Utsav Mitra…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/event/:id" element={<EventLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="shopping" element={<Shopping />} />
          <Route path="notices" element={<Notices />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="members" element={<Members />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

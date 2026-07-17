import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import EventLayout from "@/pages/EventLayout";
import Dashboard from "@/pages/Dashboard";
import Expenses from "@/pages/Expenses";
import Tasks from "@/pages/Tasks";
import Shopping from "@/pages/Shopping";
import Notices from "@/pages/Notices";
import Gallery from "@/pages/Gallery";
import Members from "@/pages/Members";
import Templates from "@/pages/Templates";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid h-full place-items-center text-text-dim">Loading…</div>;
  }
  if (!user) return <Login />;
  return (
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
  );
}

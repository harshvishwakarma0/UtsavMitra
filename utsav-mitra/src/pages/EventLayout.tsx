import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { EventDoc } from "@/types";
import { Home as HomeIcon, Wallet, CheckSquare, ShoppingCart, Bell, Images, Users, ArrowLeft } from "lucide-react";

const tabs = [
  { to: "", label: "Dashboard", icon: HomeIcon, end: true },
  { to: "expenses", label: "Expense", icon: Wallet },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "shopping", label: "Shop", icon: ShoppingCart },
  { to: "notices", label: "Notices", icon: Bell },
  { to: "gallery", label: "Photos", icon: Images },
  { to: "members", label: "Team", icon: Users },
];

const subcollections = ["expenses", "tasks", "shopping", "notices", "gallery"] as const;
export type EventSubcollection = (typeof subcollections)[number];
export type EventSubcollectionCounts = Record<EventSubcollection, number>;

const emptySubcollectionCounts: EventSubcollectionCounts = {
  expenses: 0,
  tasks: 0,
  shopping: 0,
  notices: 0,
  gallery: 0,
};

export default function EventLayout() {
  const { id } = useParams();
  const nav = useNavigate();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [subcollectionCounts, setSubcollectionCounts] = useState<EventSubcollectionCounts>(emptySubcollectionCounts);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, "events", id),
      (snap) => {
        if (snap.exists()) {
          setEvent({ id: snap.id, ...snap.data() } as EventDoc);
        }
      },
      (err) => {
        console.error("Event snapshot error:", err);
      },
    );
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setSubcollectionCounts(emptySubcollectionCounts);
    const unsubscribers = subcollections.map((name) =>
      onSnapshot(
        collection(db, "events", id, name),
        (snap) => setSubcollectionCounts((previous) => ({ ...previous, [name]: snap.size })),
        (err) => console.error(`Count snapshot error for ${name}:`, err),
      ),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [id]);

  return (
    <div className="flex h-screen flex-col bg-background text-text">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 shrink-0">
        <button
          onClick={() => nav("/")}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          All Events
        </button>
        <span className="text-xs font-medium text-text truncate max-w-[200px]">
          {event?.title || `Event: ${id?.slice(0, 8)}`}
        </span>
      </header>

      {/* Desktop top nav (hidden on mobile) */}
      <nav className="hidden md:flex items-center gap-1 border-b border-border bg-surface px-4 py-0 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to ? `/event/${id}/${t.to}` : `/event/${id}`}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "text-primary border-primary"
                  : "text-text-dim border-transparent hover:text-text hover:border-text-dim/30"
              }`
            }
          >
            <t.icon size={16} aria-hidden="true" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto">
        <Outlet context={{ event, eventId: id!, subcollectionCounts }} />
      </main>

      {/* Mobile bottom nav (hidden on desktop) */}
      <nav className="sticky bottom-0 grid grid-cols-7 border-t border-border bg-surface shrink-0 shadow-lg md:hidden">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to ? `/event/${id}/${t.to}` : `/event/${id}`}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary bg-surface-2/60 border-t-2 border-primary" : "text-text-dim hover:text-text"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon size={18} aria-hidden="true" />
                <span className="truncate w-full text-center px-0.5" aria-current={isActive ? "page" : undefined}>
                  {t.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

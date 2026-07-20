import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
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

export default function EventLayout() {
  const { id } = useParams();
  const nav = useNavigate();

  return (
    <div className="flex h-screen flex-col bg-background text-text">
      {/* Top bar for easy navigation back to events list */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 shrink-0">
        <button
          onClick={() => nav("/")}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          All Events
        </button>
        <span className="text-xs text-text-dim font-mono truncate max-w-[150px]">Event: {id?.slice(0, 8)}...</span>
      </header>

      <main className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto">
        <Outlet context={{ eventId: id! }} />
      </main>

      <nav className="sticky bottom-0 grid grid-cols-7 border-t border-border bg-surface shrink-0 shadow-lg">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={`/event/${id}/${t.to}`}
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

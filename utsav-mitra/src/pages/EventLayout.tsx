import { NavLink, Outlet, useParams } from "react-router-dom";
import { Home as HomeIcon, Wallet, CheckSquare, ShoppingCart, Bell, Images, Users } from "lucide-react";

const tabs = [
  { to: "", label: "Home", icon: HomeIcon, end: true },
  { to: "expenses", label: "Expense", icon: Wallet },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "shopping", label: "Shop", icon: ShoppingCart },
  { to: "notices", label: "Notices", icon: Bell },
  { to: "gallery", label: "Photos", icon: Images },
  { to: "members", label: "Team", icon: Users },
];

export default function EventLayout() {
  const { id } = useParams();
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ eventId: id! }} />
      </main>
      <nav className="sticky bottom-0 grid grid-cols-7 border-t border-border bg-surface">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={`/event/${id}/${t.to}`}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 text-[10px] ${
                isActive ? "text-primary" : "text-text-dim"
              }`
            }
          >
            <t.icon size={20} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

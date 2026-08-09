import {
  Activity,
  Building2,
  CalendarClock,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import BrandLogo from "../../../BrandLogo.jsx";

const NAV_ITEMS = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard },
  { key: "registrations", label: "User Registrations", icon: Users },
  { key: "verifications", label: "Verification Evidence", icon: ShieldCheck },
  { key: "companies", label: "Companies & Job Posts", icon: Building2 },
  { key: "interviews", label: "Interview Monitoring", icon: CalendarClock },
  { key: "system", label: "System Status", icon: Activity },
  { key: "audit", label: "Audit Log", icon: History },
];

export default function AdminLayout({ admin, activePage, onNavigate, onLogout, pageBadge, children }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand">
          <BrandLogo />
          <div className="brand-text">
            <div className="name">HireIQ</div>
            <div className="admin-brand-subtitle">Administration Console</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Administration sections">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`admin-nav-item ${activePage === key ? "active" : ""}`} onClick={() => onNavigate(key)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-row">
            <div className="dashboard-user-avatar"><UserCog size={15} /></div>
            <div className="admin-profile-copy">
              <div className="admin-profile-name">{admin?.fullName || admin?.email || "Administrator"}</div>
              <div className="admin-profile-role">Designated system administrator</div>
            </div>
          </div>
          <button className="admin-signout" onClick={onLogout}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-console-context">
            <ClipboardList size={17} />
            <div><strong>Identity and platform oversight</strong><span>Live data from HireIQ services</span></div>
          </div>
          <div className="admin-session-email">{admin?.email}</div>
        </header>

        <main className="admin-page">
          {pageBadge && <span className="admin-page-badge">{pageBadge}</span>}
          {children}
        </main>
      </div>
    </div>
  );
}

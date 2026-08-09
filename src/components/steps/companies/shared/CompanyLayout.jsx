import { useEffect, useState } from "react";
import { Bell, BriefcaseBusiness, Building2, CalendarClock, LayoutDashboard, LogOut, ShieldCheck, UserRoundSearch } from "lucide-react";
import BrandLogo from "../../../BrandLogo.jsx";
import { notificationsApi } from "../../../../lib/api.js";

const NAV_ITEMS = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard },
  { key: "jobs", label: "Vacancy Posts", icon: BriefcaseBusiness },
  { key: "applicants", label: "Applicants & Ranking", icon: UserRoundSearch },
  { key: "interviews", label: "Interviews", icon: CalendarClock },
  { key: "calendar", label: "Calendar", icon: CalendarClock },
  { key: "profile", label: "Company Profile", icon: Building2 },
];

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}

export default function CompanyLayout({ user, activePage, onNavigate, onLogout, pageBadge, children }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read);

  useEffect(() => {
    let active = true;
    notificationsApi.list().then((rows) => { if (active) setNotifications(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const markAllRead = async () => {
    await Promise.allSettled(unread.map((item) => notificationsApi.markRead(item.id)));
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand"><BrandLogo /><div className="brand-text"><div className="name">HireIQ</div><div className="admin-brand-subtitle">Company Portal</div></div></div>
        <nav className="admin-nav">{NAV_ITEMS.map(({ key, label, icon: Icon }) => <button key={key} className={`admin-nav-item ${activePage === key ? "active" : ""}`} onClick={() => onNavigate(key)}><Icon size={16} /> {label}</button>)}</nav>
        <div className="admin-sidebar-footer"><div className="admin-profile-row"><div className="dashboard-user-avatar"><Building2 size={15} /></div><div className="admin-profile-copy"><div className="admin-profile-name">{user?.fullName || user?.email}</div><div className="admin-profile-role">Verified company account</div></div></div><button className="admin-signout" onClick={onLogout}><LogOut size={15} /> Sign out</button></div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar"><div className="admin-console-context"><ShieldCheck size={17} /><div><strong>Company recruitment workspace</strong><span>Live vacancies, applicants and interviews</span></div></div><div className="admin-topbar-actions" style={{ position: "relative" }}><button className="icon-btn" onClick={() => setOpen((value) => !value)}><Bell size={16} />{!!unread.length && <span className="icon-badge">{unread.length}</span>}</button>{open && <><div className="dropdown-backdrop" onClick={() => setOpen(false)} /><div className="dropdown-panel notification-panel"><div className="dropdown-panel-header"><span>Notifications</span>{!!unread.length && <button className="link-sm" onClick={markAllRead}>Mark all read</button>}</div><div className="notification-list">{notifications.map((item) => <div key={item.id} className={`notification-row ${item.read ? "" : "unread"}`}><div className="notification-icon"><Bell size={13} /></div><div><div className="notification-text"><strong>{item.title}</strong> — {item.message}</div><div className="notification-time">{formatDate(item.created_at)}</div></div></div>)}{!notifications.length && <div className="verification-asset-empty">No notifications.</div>}</div></div></>}</div></header>
        <main className="admin-page">{pageBadge && <span className="admin-page-badge">{pageBadge}</span>}{children}</main>
      </div>
    </div>
  );
}

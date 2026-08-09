import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import BrandLogo from "../../../BrandLogo.jsx";
import { notificationsApi } from "../../../../lib/api.js";

const NAV_ITEMS = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard },
  { key: "jobs", label: "Job Marketplace", icon: BriefcaseBusiness },
  { key: "applications", label: "My Applications", icon: FileText },
  { key: "interviews", label: "Interviews", icon: CalendarClock },
  { key: "calendar", label: "Calendar", icon: CalendarClock },
  { key: "profile", label: "Profile & CV", icon: UserCog },
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function CandidateLayout({ user, activePage, onNavigate, onLogout, pageBadge, children }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    let active = true;
    notificationsApi.list().then((rows) => { if (active) setNotifications(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const markAllRead = async () => {
    const unread = notifications.filter((item) => !item.read);
    await Promise.allSettled(unread.map((item) => notificationsApi.markRead(item.id)));
    setNotifications((rows) => rows.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand">
          <BrandLogo />
          <div className="brand-text"><div className="name">HireIQ</div><div className="admin-brand-subtitle">Candidate Portal</div></div>
        </div>
        <nav className="admin-nav">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => <button key={key} className={`admin-nav-item ${activePage === key ? "active" : ""}`} onClick={() => onNavigate(key)}><Icon size={16} /> {label}</button>)}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-profile-row"><div className="dashboard-user-avatar"><UserCog size={15} /></div><div className="admin-profile-copy"><div className="admin-profile-name">{user?.fullName || user?.email}</div><div className="admin-profile-role">Verified candidate</div></div></div>
          <button className="admin-signout" onClick={onLogout}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-console-context"><BriefcaseBusiness size={17} /><div><strong>Candidate workspace</strong><span>Live jobs, applications and interviews</span></div></div>
          <div className="admin-topbar-actions" style={{ position: "relative" }}>
            <button className="icon-btn" onClick={() => setShowNotif((value) => !value)}><Bell size={16} />{unreadCount > 0 && <span className="icon-badge">{unreadCount}</span>}</button>
            {showNotif && <><div className="dropdown-backdrop" onClick={() => setShowNotif(false)} /><div className="dropdown-panel notification-panel"><div className="dropdown-panel-header"><span>Notifications</span>{unreadCount > 0 && <button className="link-sm" onClick={markAllRead}>Mark all read</button>}</div><div className="notification-list">{notifications.map((item) => <div key={item.id} className={`notification-row ${item.read ? "" : "unread"}`}><div className="notification-icon"><Bell size={13} /></div><div><div className="notification-text"><strong>{item.title}</strong> — {item.message}</div><div className="notification-time">{formatDate(item.created_at)}</div></div></div>)}{!notifications.length && <div className="verification-asset-empty">No notifications.</div>}</div></div></>}
          </div>
        </header>
        <main className="admin-page">{pageBadge && <span className="admin-page-badge">{pageBadge}</span>}{children}</main>
      </div>
    </div>
  );
}

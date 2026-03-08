// src/layouts/CustomerLayout.tsx
// PHASE 15: Added message badge on Bell button (combined unread notifications + messages).
// [CHANGE] Only change from original: import useUnreadMessages, combine counts on Bell.
// All JSX, layout, Tailwind classes, routes IDENTICAL to original.

import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCount, useUnreadMessages } from "@/hooks/useNotifications"; // [PHASE 15] added useUnreadMessages
import OfflineBanner from "@/components/OfflineBanner";
import {
  Home, CalendarCheck, BookOpen, User, Bell, Menu, X,
  CreditCard, MapPin, HelpCircle, Settings, LogOut, MessageSquare,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Home",        icon: Home,          path: "/customer" },
  { label: "Book Service",icon: CalendarCheck, path: "/customer/book" },
  { label: "My Bookings", icon: BookOpen,       path: "/customer/bookings" },
  { label: "Profile",     icon: User,           path: "/customer/profile" },
];

const DRAWER_ITEMS = [
  { label: "Messages",        icon: MessageSquare, path: "/messages" },          // [PHASE 15] added
  { label: "Payment Methods", icon: CreditCard,    path: "/customer/payment-methods" },
  { label: "Addresses",       icon: MapPin,        path: "/addresses" },
  { label: "Help & Support",  icon: HelpCircle,    path: "/help" },
  { label: "App Settings",    icon: Settings,      path: "/settings" },
];

export default function CustomerLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location   = useLocation();
  const navigate   = useNavigate();
  const { logout } = useAuth();
  const { data: unreadCount    } = useUnreadCount();
  const { data: unreadMessages } = useUnreadMessages(); // [PHASE 15]

  // [PHASE 15] Bell shows combined: notifications + unread messages
  const totalUnread = (unreadCount ?? 0) + (unreadMessages ?? 0);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell flex flex-col min-h-screen">
      <OfflineBanner />

      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Indore, MP</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications")}
            className="relative touch-target flex items-center justify-center rounded-full p-2 transition-default hover:bg-muted"
          >
            <Bell className="h-5 w-5 text-foreground" />
            {totalUnread > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="touch-target flex items-center justify-center rounded-full p-2 transition-default hover:bg-muted"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-[430px] border-t border-border bg-card">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`touch-target flex flex-1 flex-col items-center gap-1 py-2.5 transition-default ${
                  active ? "bottom-nav-active" : "text-muted-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 ${active ? "fill-primary" : ""}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Side Drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 h-full w-72 max-w-[80vw] bg-card shadow-xl animate-slide-in-right border-l border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <span className="font-bold text-foreground">Menu</span>
              <button onClick={() => setDrawerOpen(false)} className="touch-target p-2 rounded-full hover:bg-muted transition-default">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col py-2">
              {DRAWER_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { if (item.path) { navigate(item.path); setDrawerOpen(false); } }}
                  className="touch-target flex items-center gap-3 px-5 py-3.5 text-foreground hover:bg-muted transition-default"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {/* [PHASE 15] Unread message badge on Messages drawer item */}
                  {item.label === "Messages" && (unreadMessages ?? 0) > 0 && (
                    <span className="ml-auto h-5 min-w-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                      {(unreadMessages ?? 0) > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </button>
              ))}
              <div className="my-2 border-t border-border" />
              <button
                onClick={handleLogout}
                className="touch-target flex items-center gap-3 px-5 py-3.5 text-destructive hover:bg-destructive/10 transition-default"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
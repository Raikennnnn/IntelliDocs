import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";

interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "update";
  title: string;
  message: string;
  date: string;
  read: boolean;
}

function formatNotificationDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/student/notifications");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load notifications");
      }
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
    try {
      await apiFetch("/api/student/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_read: [id] }),
      });
    } catch {
      toast.error("Could not mark notification as read");
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    try {
      await apiFetch("/api/student/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
    } catch {
      toast.error("Could not mark all as read");
      loadNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-600" />;
      case "update":
        return <Clock className="w-5 h-5 text-[#8B1538]" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-600";
      case "warning":
        return "bg-yellow-600";
      case "info":
        return "bg-blue-600";
      case "update":
        return "bg-[#8B1538]";
      default:
        return "bg-gray-600";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading notifications…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" onClick={loadNotifications}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Notifications</h2>
          <p className="text-gray-600">Stay updated with your enrollment progress</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-sm text-[#8B1538] hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <Card className="border-[#8B1538] bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#8B1538]" />
              <p className="text-sm font-medium text-[#8B1538]">
                You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                !notification.read ? "border-l-4 border-l-[#8B1538]" : ""
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {getNotificationIcon(notification.type)}
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold">
                        {notification.title}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatNotificationDate(notification.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.read && (
                      <Badge className={`${getNotificationBadgeColor(notification.type)} text-white`}>
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{notification.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

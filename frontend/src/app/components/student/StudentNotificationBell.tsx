import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useStudentLocale } from "../../context/StudentLocaleContext";
import {
  formatStudentNotificationDate,
  studentNotificationHref,
  useStudentNotifications,
  type StudentNotification,
} from "../../lib/studentNotifications";

function NotificationIcon({ type }: { type: StudentNotification["type"] }) {
  switch (type) {
    case "success":
      return <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />;
    case "warning":
      return <AlertCircle className="w-4 h-4 shrink-0 text-yellow-600" />;
    case "info":
      return <Info className="w-4 h-4 shrink-0 text-blue-600" />;
    case "update":
      return <Clock className="w-4 h-4 shrink-0 text-[#8B1538]" />;
    default:
      return <Bell className="w-4 h-4 shrink-0 text-gray-600" />;
  }
}

export function StudentNotificationBell() {
  const { t } = useStudentLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    loading,
    error,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useStudentNotifications(true);

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("notifications.markAllReadError"));
    }
  };

  const handleNotificationClick = async (notification: StudentNotification) => {
    if (!notification.read) {
      try {
        await markAsRead(notification.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("notifications.markReadError"));
      }
    }
    setOpen(false);
    navigate(studentNotificationHref(notification));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadNotifications();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0 text-white hover:bg-white/10"
          aria-label={t("nav.notifications")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-none text-[#8B1538]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{t("nav.notifications")}</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              className="text-xs font-medium text-[#8B1538] hover:underline"
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("notifications.loading")}
            </div>
          ) : error ? (
            <div className="space-y-3 p-4 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadNotifications()}>
                {t("notifications.retry")}
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">{t("notifications.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538]/30 ${
                      !notification.read ? "bg-red-50/40" : ""
                    }`}
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-2">
                      <NotificationIcon type={notification.type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatStudentNotificationDate(notification.date)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-700">{notification.message}</p>
                      </div>
                      {!notification.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8B1538]" aria-hidden />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

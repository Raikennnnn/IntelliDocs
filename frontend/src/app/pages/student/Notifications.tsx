import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";
import { useState } from "react";

interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "update";
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "update",
      title: "Application Status Update",
      message: "Your enrollment application is now under review. The Registrar is verifying your documents.",
      date: "March 18, 2026 - 2:30 PM",
      read: false,
    },
    {
      id: "2",
      type: "success",
      title: "Document Verified",
      message: "Your Birth Certificate has been successfully verified by our AI system.",
      date: "March 17, 2026 - 4:15 PM",
      read: false,
    },
    {
      id: "3",
      type: "warning",
      title: "Document Issue Detected",
      message: "There's an issue with your SF10 / Form 137. Please check the Application Status page for details.",
      date: "March 17, 2026 - 11:20 AM",
      read: true,
    },
    {
      id: "4",
      type: "success",
      title: "Application Submitted",
      message: "Your enrollment application has been successfully submitted. Application ID: APP-2026-001",
      date: "March 15, 2026 - 9:45 AM",
      read: true,
    },
    {
      id: "5",
      type: "info",
      title: "Welcome to IntelliDocs",
      message: "Thank you for registering with IntelliDocs. You can now start your enrollment application.",
      date: "March 14, 2026 - 3:00 PM",
      read: true,
    },
  ]);

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

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Notifications
          </h2>
          <p className="text-gray-600">
            Stay updated with your enrollment progress
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-[#8B1538] hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Unread Count */}
      {unreadCount > 0 && (
        <Card className="border-[#8B1538] bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#8B1538]" />
              <p className="text-sm text-[#8B1538] font-medium">
                You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer hover:border-[#8B1538] transition-colors ${
                !notification.read ? 'border-l-4 border-l-[#8B1538] bg-red-50' : ''
              }`}
              onClick={() => markAsRead(notification.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className={`font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-[#8B1538]" />
                        )}
                        <Badge className={getNotificationBadgeColor(notification.type)}>
                          {notification.type}
                        </Badge>
                      </div>
                    </div>
                    <p className={`text-sm mb-2 ${!notification.read ? 'text-gray-700' : 'text-gray-600'}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500">{notification.date}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

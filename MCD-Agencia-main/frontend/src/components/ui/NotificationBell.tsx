'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from '@/lib/api/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const permissions = usePermissions();
  const locale = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canViewNotifications = permissions.canAccessDashboard;

  useEffect(() => {
    if (!isAuthenticated || !canViewNotifications) return;

    const fetchData = async () => {
      try {
        const [countData, notifData] = await Promise.all([
          getUnreadCount(),
          getNotifications(),
        ]);
        setUnreadCount(countData.unread_count);
        setNotifications(notifData.results?.slice(0, 10) || []);
      } catch {
        // Silent fail
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, [isAuthenticated, canViewNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  if (!isAuthenticated || !canViewNotifications) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        aria-label="Notificaciones"
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="h-6 w-6 text-cmyk-cyan" />
        ) : (
          <BellIcon className="h-6 w-6" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-cmyk-magenta text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white border border-neutral-200 rounded-lg shadow-xl backdrop-blur-sm z-50 overflow-hidden dark:bg-cmyk-black/95 dark:border-cmyk-cyan/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-cmyk-cyan/10">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-cmyk-cyan hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500 text-sm">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) handleMarkRead(notif.id);
                    if (notif.action_url) setIsOpen(false);
                  }}
                  className={`block px-4 py-3 border-b border-neutral-200 dark:border-cmyk-cyan/10 hover:bg-cmyk-cyan/10 transition-colors cursor-pointer ${
                    !notif.is_read ? 'bg-cmyk-cyan/5' : ''
                  }`}
                >
                  {notif.action_url ? (
                    <Link href={`/${locale}${notif.action_url}`} className="block">
                      <div className="flex items-start gap-2">
                        {!notif.is_read && (
                          <div className="mt-1.5 h-2 w-2 rounded-full bg-cmyk-cyan flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-white font-medium truncate">{notif.title}</p>
                          {notif.message && (
                            <p className="text-xs text-neutral-400 mt-0.5 truncate">{notif.message}</p>
                          )}
                          <p className="text-xs text-neutral-500 mt-1">{formatTime(notif.created_at)}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2">
                      {!notif.is_read && (
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-cmyk-cyan flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-900 dark:text-white font-medium truncate">{notif.title}</p>
                        {notif.message && (
                          <p className="text-xs text-neutral-400 mt-0.5 truncate">{notif.message}</p>
                        )}
                        <p className="text-xs text-neutral-500 mt-1">{formatTime(notif.created_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

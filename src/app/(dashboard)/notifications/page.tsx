'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) setNotifications(data.notifications);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      fetchNotifications();
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Notifications Center"
        subtitle="System alerts for tickets, support requests, and assignments"
        extraActions={
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
          >
            <CheckCheck size={14} /> Mark All as Read
          </button>
        }
      />

      <div className="p-6 max-w-4xl mx-auto space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center bg-[#101114] hairline-border rounded-xl space-y-2">
            <Bell size={32} className="text-gray-600 mx-auto" />
            <h3 className="text-sm font-semibold text-gray-200">No Notifications</h3>
            <p className="text-xs text-gray-500">You are all caught up.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl hairline-border text-xs flex items-center justify-between transition-colors ${
                !n.isRead ? 'bg-[#5e6ad2]/10 border-[#5e6ad2]/30' : 'bg-[#101114]'
              }`}
            >
              <div className="space-y-1">
                <p className="text-gray-200 font-medium">{n.message}</p>
                <span className="text-[10px] text-gray-500 font-mono">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>

              {n.link && (
                <Link
                  href={n.link}
                  className="px-3 py-1.5 bg-white/5 hover:bg-[#5e6ad2] text-gray-300 hover:text-white rounded-md text-xs font-medium transition-colors shrink-0"
                >
                  View
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

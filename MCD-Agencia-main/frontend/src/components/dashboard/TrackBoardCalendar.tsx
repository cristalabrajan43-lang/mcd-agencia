'use client';

import { useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

import { Card, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface TrackItem {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  status_display?: string;
  date?: string | null;
  date_label?: string;
  start?: string | null;
  end?: string | null;
  note?: string;
  amount?: string | null;
  href: string;
}

export interface TrackColumn {
  key: string;
  label: string;
  subtitle?: string;
  statuses: string[];
  empty: string;
  accent: string;
}

export interface TrackStat {
  label: string;
  count: number;
  tone: string;
  icon: ComponentType<{ className?: string }>;
}

interface TrackBoardCalendarProps {
  title: string;
  description: string;
  stats: TrackStat[];
  columns: TrackColumn[];
  items: TrackItem[];
  loading?: boolean;
  error?: string | null;
  renderItemActions?: (item: TrackItem) => React.ReactNode;
}

function parseSafeDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const trimmed = String(dateString).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCalendarLabel(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
  });
}

function getItemDate(item: TrackItem): Date | null {
  return parseSafeDate(item.start || item.date || item.end || null);
}

export function TrackBoardCalendar({
  title,
  description,
  stats,
  columns,
  items,
  loading = false,
  error = null,
  renderItemActions,
}: TrackBoardCalendarProps) {
  const locale = useLocale();
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const boardItemsByColumn = useMemo(() => {
    const map = new Map<string, TrackItem[]>();
    columns.forEach((column) => {
      map.set(column.key, items.filter((item) => column.statuses.includes(item.status)));
    });
    return map;
  }, [columns, items]);

  const calendarEvents = useMemo(() => {
    return items
      .map((item) => ({ item, date: getItemDate(item) }))
      .filter((entry): entry is { item: TrackItem; date: Date } => !!entry.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [items]);

  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    const days: Date[] = [];

    for (let i = 0; i < 42; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Array<{ item: TrackItem; date: Date }>>();
    calendarEvents.forEach((entry) => {
      const key = entry.date.toISOString().slice(0, 10);
      const bucket = map.get(key) || [];
      bucket.push(entry);
      map.set(key, bucket);
    });
    return map;
  }, [calendarEvents]);

  const monthLabel = formatCalendarLabel(monthCursor);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        <p className="text-neutral-400 text-sm max-w-3xl">{description}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', stat.tone)}>
                  <StatIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-neutral-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{loading ? '...' : stat.count}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('board')}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm transition-colors',
            viewMode === 'board'
              ? 'border-cmyk-cyan/50 bg-cmyk-cyan/10 text-cmyk-cyan'
              : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
          )}
        >
          Tablón
        </button>
        <button
          type="button"
          onClick={() => setViewMode('calendar')}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm transition-colors',
            viewMode === 'calendar'
              ? 'border-cmyk-cyan/50 bg-cmyk-cyan/10 text-cmyk-cyan'
              : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
          )}
        >
          Calendario
        </button>
      </div>

      {viewMode === 'board' ? (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
          {columns.map((column) => {
            const columnItems = boardItemsByColumn.get(column.key) || [];
            return (
              <Card key={column.key} className={cn('p-4 border-t-2', column.accent)}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-semibold text-white">{column.label}</h2>
                    {column.subtitle && <p className="text-xs text-neutral-400 mt-1">{column.subtitle}</p>}
                  </div>
                  <Badge variant="default" className="bg-neutral-800 text-neutral-200 border-neutral-700">
                    {columnItems.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {columnItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500">
                      {column.empty}
                    </div>
                  ) : (
                    columnItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 hover:border-cmyk-cyan/40 hover:bg-neutral-900/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={item.href} className="text-sm font-semibold text-white truncate hover:text-cmyk-cyan transition-colors">
                              {item.title}
                            </Link>
                            {item.subtitle && <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.subtitle}</p>}
                          </div>
                          <span className="text-[10px] uppercase tracking-wide rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-neutral-300">
                            {item.status_display || item.status}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-300">
                          {item.date && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-1">
                              <ClockIcon className="h-3.5 w-3.5" />
                              {item.date_label || 'Fecha'}
                            </span>
                          )}
                          {item.amount && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-1">
                              ${Number(item.amount).toLocaleString('es-MX')}
                            </span>
                          )}
                        </div>

                        {item.date && (
                          <p className="mt-2 text-xs text-cmyk-cyan">{item.date}</p>
                        )}
                        {item.note && <p className="mt-1 text-xs text-neutral-400">{item.note}</p>}

                        {renderItemActions && (
                          <div className="mt-3">
                            {renderItemActions(item)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-cmyk-cyan" />
                {monthLabel}
              </h2>
              <p className="text-sm text-neutral-400">{calendarEvents.length} eventos visibles</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 hover:bg-neutral-800"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-300 hover:bg-neutral-800"
              >
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="text-center py-1">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const dayEvents = eventsByDay.get(key) || [];
              const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[120px] rounded-lg border p-2 bg-neutral-950/60',
                    isCurrentMonth ? 'border-neutral-800' : 'border-neutral-900 opacity-60'
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className={cn('text-xs font-medium', isCurrentMonth ? 'text-white' : 'text-neutral-500')}>
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] rounded-full bg-cmyk-cyan/15 text-cmyk-cyan px-2 py-0.5">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {dayEvents.slice(0, 3).map(({ item }) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-md border border-neutral-800 bg-neutral-900/80 p-2 text-xs hover:border-cmyk-cyan/40 transition-colors"
                      >
                        <p className="font-medium text-white truncate">{item.title}</p>
                        {item.subtitle && <p className="text-neutral-400 truncate">{item.subtitle}</p>}
                        <p className="text-cmyk-cyan mt-1 truncate">{item.date_label || item.status_display || item.status}</p>
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[11px] text-neutral-500">+{dayEvents.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

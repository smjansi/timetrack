import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ReportRow, ReviewEntry, ReviewRow } from '../domain/review';
import type { ReviewStatus, TsStatus } from '../domain/timesheet';

export interface PendingItem {
  id: string;
  user_id: string;
  employee: string;
  week_start: string;
  entries: ReviewEntry[];
  reviews: ReviewRow[];
}

export interface TeamMember {
  id: string;
  full_name: string;
}

export interface ReportFilters {
  userId: string;
  status: string;
}

function client() {
  if (!supabase) throw new Error('The app is not connected to Supabase.');
  return supabase;
}

const SELECT =
  'id, user_id, week_start, status, profiles(full_name), ' +
  'entries(id, entry_date, project_id, task_id, hours, is_rejected, rejected_at), ' +
  'day_reviews(entry_date, status, comment, reviewed_at)';

interface RawTimesheet {
  id: string;
  user_id: string;
  week_start: string;
  status: TsStatus;
  profiles: { full_name: string } | null;
  entries: (Omit<ReviewEntry, 'hours'> & { hours: unknown })[];
  day_reviews: ReviewRow[];
}

const toItem = (t: RawTimesheet): PendingItem => ({
  id: t.id,
  user_id: t.user_id,
  employee: t.profiles?.full_name ?? 'Unknown',
  week_start: t.week_start,
  entries: t.entries.map((e) => ({ ...e, hours: Number(e.hours) })),
  reviews: t.day_reviews,
});

/** Submitted timesheets of the team (RLS), excluding the manager's own. */
export function usePendingTimesheets(managerId: string) {
  return useQuery({
    queryKey: ['pending', managerId],
    queryFn: async (): Promise<PendingItem[]> => {
      const { data, error } = await client()
        .from('timesheets')
        .select(SELECT)
        .eq('status', 'Submitted')
        .neq('user_id', managerId);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as RawTimesheet[])
        .map(toItem)
        .sort((a, b) => a.employee.localeCompare(b.employee) || b.week_start.localeCompare(a.week_start));
    },
  });
}

/** One timesheet for review; null if it is gone or no longer Submitted. */
export function useReviewTimesheet(id: string | undefined) {
  return useQuery({
    queryKey: ['review', id],
    enabled: !!id,
    queryFn: async (): Promise<PendingItem | null> => {
      const { data, error } = await client().from('timesheets').select(SELECT).eq('id', id as string).maybeSingle();
      if (error) throw new Error(error.message);
      const t = data as unknown as RawTimesheet | null;
      return t && t.status === 'Submitted' ? toItem(t) : null;
    },
  });
}

export function useReviewDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { timesheetId: string; date: string; status: ReviewStatus; comment: string }): Promise<TsStatus> => {
      const { data, error } = await client().rpc('review_day', {
        p_timesheet: v.timesheetId,
        p_date: v.date,
        p_status: v.status,
        p_comment: v.comment,
      });
      if (error) throw new Error(error.message);
      return data as TsStatus;
    },
    onSuccess: () =>
      Promise.all(
        ['pending', 'review', 'pending-count', 'report', 'timesheets', 'timesheet'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

/** The manager and their reports (RLS decides who is visible). */
export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await client().from('profiles').select('id, full_name').order('full_name');
      if (error) throw new Error(error.message);
      return (data ?? []) as TeamMember[];
    },
  });
}

export function useReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ['report', filters.userId, filters.status],
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await client().rpc('report_entries', {
        p_user: filters.userId === 'All' ? null : filters.userId,
        p_status: filters.status === 'All' ? null : filters.status,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as ReportRow[]).map((r) => ({ ...r, hours: Number(r.hours) }));
    },
  });
}

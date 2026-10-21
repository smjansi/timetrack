import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { DayReview, Entry, ProjectHours, TsStatus } from '../domain/timesheet';

export interface Option {
  id: string;
  name: string;
}

export interface TimesheetListItem {
  id: string;
  week_start: string;
  status: TsStatus;
  comment: string;
  entries: { hours: number; is_rejected: boolean }[];
}

export interface TimesheetDetail {
  id: string;
  user_id: string;
  week_start: string;
  status: TsStatus;
  comment: string;
  entries: Entry[];
  day_reviews: DayReview[];
}

export interface EntryInput {
  timesheet_id: string;
  entry_date: string;
  project_id: string;
  task_id: string;
  hours: number;
  notes: string;
}

function client() {
  if (!supabase) throw new Error('The app is not connected to Supabase.');
  return supabase;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(apiMessage(error.message));
}

const num = (n: unknown): number => Number(n);

export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<{ projects: Option[]; tasks: Option[] }> => {
      const [projects, tasks] = await Promise.all([
        client().from('projects').select('id, name').eq('active', true).order('name'),
        client().from('tasks').select('id, name').eq('active', true).order('name'),
      ]);
      fail(projects.error);
      fail(tasks.error);
      return { projects: (projects.data ?? []) as Option[], tasks: (tasks.data ?? []) as Option[] };
    },
  });
}

export function useTimesheetList(userId: string) {
  return useQuery({
    queryKey: ['timesheets', userId],
    queryFn: async (): Promise<TimesheetListItem[]> => {
      const { data, error } = await client()
        .from('timesheets')
        .select('id, week_start, status, comment, entries(hours, is_rejected)')
        .eq('user_id', userId)
        .order('week_start', { ascending: false });
      fail(error);
      return ((data ?? []) as unknown as TimesheetListItem[]).map((t) => ({
        ...t,
        entries: t.entries.map((e) => ({ hours: num(e.hours), is_rejected: e.is_rejected })),
      }));
    },
  });
}

export function useTimesheet(id: string | undefined) {
  return useQuery({
    queryKey: ['timesheet', id],
    enabled: !!id,
    queryFn: async (): Promise<TimesheetDetail | null> => {
      const { data, error } = await client()
        .from('timesheets')
        .select(
          'id, user_id, week_start, status, comment, ' +
            'entries(id, entry_date, project_id, task_id, hours, notes, is_rejected, created_at), ' +
            'day_reviews(entry_date, status, comment)',
        )
        .eq('id', id as string)
        .maybeSingle();
      fail(error);
      if (!data) return null;
      const t = data as unknown as TimesheetDetail;
      return {
        ...t,
        entries: t.entries
          .map((e) => ({ ...e, hours: num(e.hours) }))
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      };
    },
  });
}

export function useMonthSummary(month: string) {
  return useQuery({
    queryKey: ['month-summary', month],
    queryFn: async (): Promise<ProjectHours[]> => {
      const { data, error } = await client().rpc('my_month_summary', { p_month: month });
      fail(error);
      return ((data ?? []) as { project: string; hours: unknown }[]).map((r) => ({
        name: r.project,
        hours: num(r.hours),
      }));
    },
  });
}

/** Refresh everything a change to timesheets or entries can affect. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['timesheets', 'timesheet', 'month-summary', 'pending-count'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useCreateTimesheet() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await client().rpc('create_next_timesheet');
      fail(error);
      return data as string;
    },
    onSuccess: refresh,
  });
}

export function useSubmitTimesheet() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (timesheetId: string): Promise<void> => {
      const { error } = await client().rpc('submit_timesheet', { p_timesheet: timesheetId });
      fail(error);
    },
    onSuccess: refresh,
  });
}

export function useSaveEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ entryId, input }: { entryId: string | null; input: EntryInput }): Promise<void> => {
      if (entryId) {
        const { entry_date, project_id, task_id, hours, notes } = input;
        const { error } = await client()
          .from('entries')
          .update({ entry_date, project_id, task_id, hours, notes })
          .eq('id', entryId);
        fail(error);
      } else {
        const { error } = await client().from('entries').insert(input);
        fail(error);
      }
    },
    onSuccess: refresh,
  });
}

export function useDeleteEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (entryId: string): Promise<void> => {
      const { error } = await client().from('entries').delete().eq('id', entryId);
      fail(error);
    },
    onSuccess: refresh,
  });
}

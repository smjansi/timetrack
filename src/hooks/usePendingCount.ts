import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

/** Submitted timesheets waiting for the signed-in manager (RLS limits them to the team). */
export function usePendingCount(): number {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const { data } = useQuery({
    queryKey: ['pending-count', profile?.id],
    enabled: isManager && !!supabase,
    queryFn: async () => {
      if (!supabase || !profile) return 0;
      const { count, error } = await supabase
        .from('timesheets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Submitted')
        .neq('user_id', profile.id);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
  return data ?? 0;
}

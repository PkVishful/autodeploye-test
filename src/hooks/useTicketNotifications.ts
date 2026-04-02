import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketRole } from '@/hooks/useTicketRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const THRESHOLD = 10;

export function useTicketNotifications() {
  const { profile } = useAuth();
  const { isEmployee, isAdmin } = useTicketRole();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orgId = profile?.organization_id;
  const shouldCheck = (isEmployee || isAdmin) && !!orgId;

  useEffect(() => {
    if (!shouldCheck) return;

    const checkPending = async () => {
      const { count } = await supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'assigned', 'in_progress']);
      if (count && count > THRESHOLD) {
        toast({
          title: `⚠️ ${count} pending tickets`,
          description: 'There are more than 10 open tickets. Please prioritize closing them.',
          variant: 'destructive',
        });
      }
    };

    checkPending();
    intervalRef.current = setInterval(checkPending, INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [shouldCheck, orgId]);
}

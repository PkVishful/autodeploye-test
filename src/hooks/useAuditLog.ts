import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

export function useAuditLog() {
  const { profile, user } = useAuth();

  const log = useCallback(async (
    tableName: string,
    recordId: string,
    action: 'created' | 'updated' | 'deleted',
    changes: Record<string, any> = {}
  ) => {
    if (!profile?.organization_id) return;
    try {
      await supabase.from('audit_logs' as any).insert({
        organization_id: profile.organization_id,
        table_name: tableName,
        record_id: recordId,
        action,
        changes,
        performed_by: user?.id || null,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }
  }, [profile?.organization_id, user?.id]);

  return { log };
}

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApprovalAlerts } from '@/hooks/useApprovalAlerts';
import { useTicketRole } from '@/hooks/useTicketRole';
import { useNavigate } from 'react-router-dom';

export function ApprovalAlertBanner() {
  const { costApproval, adminApproval, tenantApproval, tenantPendingTickets, total, isLoading } = useApprovalAlerts();
  const { isAdmin, isTenantRole, isEmployee } = useTicketRole();
  const navigate = useNavigate();

  if (isLoading || total === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-sm">
            {isTenantRole ? 'Action Required' : 'Tickets Awaiting Approval'}
          </span>
          <Badge variant="destructive" className="text-xs ml-auto">{total} pending</Badge>
        </div>

        {isTenantRole && tenantApproval > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              You have {tenantApproval} completed ticket(s) waiting for your confirmation. Please review and approve or reject them.
              <strong className="text-foreground"> You cannot create new tickets until these are resolved.</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {tenantPendingTickets.map((t: any) => (
                <Button key={t.id} size="sm" variant="outline" onClick={() => navigate('/tickets')} className="gap-1">
                  {t.ticket_number} <ArrowRight className="h-3 w-3" />
                </Button>
              ))}
            </div>
          </div>
        )}

        {(isAdmin || isEmployee) && (
          <div className="flex flex-wrap gap-2">
            {costApproval > 0 && (
              <Button size="sm" variant="outline" onClick={() => navigate('/tickets')} className="gap-1.5">
                Cost Approval <Badge className="bg-primary text-primary-foreground text-[10px]">{costApproval}</Badge>
              </Button>
            )}
            {adminApproval > 0 && (
              <Button size="sm" variant="outline" onClick={() => navigate('/tickets')} className="gap-1.5">
                Admin Approval <Badge className="bg-primary text-primary-foreground text-[10px]">{adminApproval}</Badge>
              </Button>
            )}
            {tenantApproval > 0 && isAdmin && (
              <Button size="sm" variant="outline" onClick={() => navigate('/tickets')} className="gap-1.5">
                Tenant Approval <Badge className="bg-primary text-primary-foreground text-[10px]">{tenantApproval}</Badge>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

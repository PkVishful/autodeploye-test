import { useState } from 'react';
import { UserCog, Shield, Trash2, Search, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { ROLE_LABELS, type AppRole } from '@/hooks/useRBAC';

const ASSIGNABLE_ROLES: AppRole[] = ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician', 'tenant'];

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-destructive/10 text-destructive border-destructive/20',
  org_admin: 'bg-primary/10 text-primary border-primary/20',
  property_manager: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  employee: 'bg-green-500/10 text-green-600 border-green-500/20',
  technician: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  tenant: 'bg-muted text-muted-foreground border-border',
};

export default function RoleManagement() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [search, setSearch] = useState('');

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_roles', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, first_name, last_name, email, phone, user_id, status')
        .eq('organization_id', orgId!)
        .order('first_name');
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch profiles to match team members
  const { data: orgProfiles = [] } = useQuery({
    queryKey: ['org_profiles_for_roles', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .eq('organization_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch all user_roles
  const { data: userRoles = [] } = useQuery({
    queryKey: ['all_user_roles', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('*');
      return data || [];
    },
    enabled: !!orgId,
  });

  // Match team members to profiles by user_id, email, or phone
  const enrichedMembers = teamMembers.map((tm: any) => {
    let profileMatch = null;
    if (tm.user_id) {
      profileMatch = orgProfiles.find((p: any) => p.id === tm.user_id);
    }
    if (!profileMatch && tm.email) {
      profileMatch = orgProfiles.find((p: any) => p.email === tm.email);
    }
    if (!profileMatch && tm.phone) {
      profileMatch = orgProfiles.find((p: any) => p.phone === tm.phone);
    }

    const profileId = profileMatch?.id;
    const roles = profileId
      ? userRoles.filter((r: any) => r.user_id === profileId).map((r: any) => r.role as AppRole)
      : [];

    return {
      ...tm,
      profileId,
      profileName: profileMatch?.full_name,
      roles,
      displayName: `${tm.first_name} ${tm.last_name}`.trim(),
      isLinked: !!profileId,
    };
  });

  const filtered = enrichedMembers.filter((m: any) => {
    const q = search.toLowerCase();
    return !q || m.displayName.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.phone?.includes(q);
  });

  const assignRole = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId || !selectedRole) throw new Error('Select a team member and role');
      const member = enrichedMembers.find((m: any) => m.id === selectedMemberId);
      if (!member) throw new Error('Member not found');

      let profileId = member.profileId;

      // If no profile linked, try to find/create profile link
      if (!profileId) {
        // Try matching by email or phone
        let matchedProfile = null;
        if (member.email) {
          matchedProfile = orgProfiles.find((p: any) => p.email === member.email);
        }
        if (!matchedProfile && member.phone) {
          matchedProfile = orgProfiles.find((p: any) => p.phone === member.phone);
        }
        if (matchedProfile) {
          profileId = matchedProfile.id;
          // Link team member to profile
          await supabase.from('team_members').update({ user_id: profileId } as any).eq('id', member.id);
        } else {
          throw new Error('No matching user profile found. The team member must sign up first with the same email or phone.');
        }
      }

      // Check existing
      const existing = userRoles.find((r: any) => r.user_id === profileId && r.role === selectedRole);
      if (existing) throw new Error('User already has this role');

      const { error } = await supabase.from('user_roles').insert({
        user_id: profileId,
        role: selectedRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_user_roles'] });
      qc.invalidateQueries({ queryKey: ['team_members_roles'] });
      setAssignOpen(false);
      setSelectedMemberId('');
      setSelectedRole('');
      toast({ title: 'Role assigned successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeRole = useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', profileId)
        .eq('role', role as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_user_roles'] });
      toast({ title: 'Role removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Role Assignment</h3>
          <Badge variant="secondary" className="text-xs">{enrichedMembers.length} members</Badge>
        </div>
        <Button className="gap-2" onClick={() => setAssignOpen(true)}>
          <UserPlus className="h-4 w-4" /> Assign Role
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Member</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No team members found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{m.displayName}</p>
                      {!m.isLinked && (
                        <p className="text-xs text-amber-600">Not linked to user account</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{m.email || '—'}</div>
                    <div>{m.phone || ''}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {m.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {m.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">No role</Badge>
                      ) : (
                        m.roles.map((role: AppRole) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className={`text-xs gap-1 ${ROLE_COLORS[role] || ''}`}
                          >
                            {ROLE_LABELS[role] || role}
                            <button
                              onClick={() => {
                                if (confirm(`Remove "${ROLE_LABELS[role]}" role from ${m.displayName}?`)) {
                                  removeRole.mutate({ profileId: m.profileId, role });
                                }
                              }}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <DrawerForm open={assignOpen} onOpenChange={setAssignOpen} title="Assign Role to Team Member">
        <div>
          <Label>Team Member</Label>
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
            <SelectContent>
              {enrichedMembers.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  <span>{m.displayName}</span>
                  {!m.isLinked && <span className="text-amber-600 ml-1">(not linked)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-full"
          onClick={() => assignRole.mutate()}
          disabled={assignRole.isPending || !selectedMemberId || !selectedRole}
        >
          {assignRole.isPending ? 'Assigning...' : 'Assign Role'}
        </Button>
      </DrawerForm>
    </div>
  );
}

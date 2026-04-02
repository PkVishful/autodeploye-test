import { useState } from 'react';
import { Plus, Megaphone, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/shared/TablePagination';

export default function Announcements() {
  const { profile, user } = useAuth();
  const orgId = profile?.organization_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'normal' });

  const { data: announcements, isLoading, page, setPage, totalPages, totalCount, pageSize } = useServerPagination({
    table: 'announcements',
    select: '*',
    pageSize: 25,
    filters: orgId ? [{ column: 'organization_id', value: orgId }] : [],
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!orgId,
    queryKey: ['admin-announcements'],
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.content.trim()) throw new Error('Title and content required');
      if (editId) {
        const { error } = await supabase.from('announcements').update({
          title: form.title, content: form.content, priority: form.priority,
        }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert({
          organization_id: orgId!, created_by: user?.id,
          title: form.title, content: form.content, priority: form.priority,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paginated', 'announcements'] });
      setOpen(false); setEditId(null); setForm({ title: '', content: '', priority: 'normal' });
      toast({ title: editId ? 'Announcement updated' : 'Announcement created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const togglePublish = useMutation({
    mutationFn: async (ann: any) => {
      const newPublished = !ann.is_published;
      const { error } = await supabase.from('announcements').update({
        is_published: newPublished,
        published_at: newPublished ? new Date().toISOString() : null,
      }).eq('id', ann.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paginated', 'announcements'] }); toast({ title: 'Status updated' }); },
  });

  const deleteAnn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paginated', 'announcements'] }); toast({ title: 'Deleted' }); },
  });

  const priorityBadge = (p: string) => {
    if (p === 'urgent') return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>;
    if (p === 'important') return <Badge className="bg-amber-500 text-white text-[10px]">Important</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Normal</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage announcements for tenants</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm({ title: '', content: '', priority: 'normal' }); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Announcement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Create'} Announcement</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" /></div>
              <div><Label>Content *</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Write your announcement..." rows={4} /></div>
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                {editId ? 'Update' : 'Create'} Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No announcements</TableCell></TableRow>
              ) : announcements.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{a.title}</TableCell>
                  <TableCell>{priorityBadge(a.priority)}</TableCell>
                  <TableCell>
                    <Badge variant={a.is_published ? 'default' : 'outline'} className="text-[10px]">
                      {a.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => togglePublish.mutate(a)}>
                        {a.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        setForm({ title: a.title, content: a.content, priority: a.priority || 'normal' });
                        setEditId(a.id); setOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm('Delete this announcement?')) deleteAnn.mutate(a.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} setPage={setPage} isLoading={isLoading} />
      </Card>
    </div>
  );
}

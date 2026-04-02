import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  setPage: (page: number) => void;
  isLoading?: boolean;
}

export function TablePagination({ page, totalPages, totalCount, pageSize, setPage, isLoading }: TablePaginationProps) {
  if (totalCount <= 0 && !isLoading) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        {totalCount > 0 ? `Showing ${from}–${to} of ${totalCount}` : 'No records'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page - 1)}
          disabled={page <= 0 || isLoading}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages - 1 || isLoading}
          className="gap-1"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

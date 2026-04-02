import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

// Detect Supabase auth errors (401/403) and trigger logout
const isAuthError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const err = error as any;
    // Supabase PostgREST returns status codes
    if (err.code === 'PGRST301' || err.code === '401' || err.code === '403') return true;
    if (err.status === 401 || err.status === 403) return true;
    if (err.message?.includes('JWT expired') || err.message?.includes('Invalid JWT')) return true;
  }
  return false;
};

const handleAuthError = () => {
  // Dynamically import to avoid circular deps
  import('@/integrations/supabase/client').then(({ supabase }) => {
    supabase.auth.signOut().then(() => {
      queryClient.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    });
  });
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthError(error)) {
        handleAuthError();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) {
        handleAuthError();
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (isAuthError(error)) return false;
        return failureCount < 1;
      },
    },
  },
});

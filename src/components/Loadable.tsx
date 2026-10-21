import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { PageHeader } from './PageHeader';

interface Props<T> {
  query: UseQueryResult<T>;
  title: string;
  backTo?: string;
  /** Render only the state message (the page already has its own header). */
  bare?: boolean;
  children: (data: T) => ReactNode;
}

/** Shows the loading and error states of a query, then renders the screen once data is there. */
export function Loadable<T>({ query, title, backTo, bare = false, children }: Props<T>) {
  if (query.isPending || query.isError) {
    const state = query.isPending ? (
      <p className="muted" role="status">Loading…</p>
    ) : (
      <>
        <div role="alert" className="error-box">{query.error.message}</div>
        <button type="button" className="btn btn-secondary" onClick={() => void query.refetch()}>
          Try again
        </button>
      </>
    );
    if (bare) return state;
    return (
      <>
        <PageHeader title={title} backTo={backTo} />
        <div className="content">{state}</div>
      </>
    );
  }
  return <>{children(query.data)}</>;
}

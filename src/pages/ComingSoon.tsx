import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';

/** Placeholder until the screen is built in a later step. */
export function ComingSoon({ title }: { title: string }) {
  const { profile } = useAuth();
  return (
    <>
      <PageHeader title={title} subtitle={profile?.full_name} />
      <div className="content">
        <div className="card empty">This screen is coming soon.</div>
      </div>
    </>
  );
}

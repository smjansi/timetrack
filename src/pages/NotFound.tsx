import { useAuth } from '../auth/AuthProvider';
import { homePath } from '../auth/access';
import { Message } from '../components/Message';

export function NotFound() {
  const { profile } = useAuth();
  return (
    <Message title="Page not found" inline actions={[{ label: 'Go to my start page', href: profile ? homePath(profile.role) : '/' }]}>
      That page does not exist.
    </Message>
  );
}

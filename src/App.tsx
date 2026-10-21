import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { Shell } from './components/Shell';
import { ApprovalDetail } from './pages/ApprovalDetail';
import { Approvals } from './pages/Approvals';
import { ComingSoon } from './pages/ComingSoon';
import { EntryForm } from './pages/EntryForm';
import { Home } from './pages/Home';
import { Reports } from './pages/Reports';
import { Summary } from './pages/Summary';
import { Weekly } from './pages/Weekly';
import { Login } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Shell />}>
                <Route index element={<Home />} />
                <Route path="timesheets/:id" element={<Weekly />} />
                <Route path="timesheets/:id/entries/new" element={<EntryForm />} />
                <Route path="timesheets/:id/entries/:entryId" element={<EntryForm />} />
                <Route path="summary" element={<Summary />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="approvals/:id" element={<ApprovalDetail />} />
                <Route path="reports" element={<Reports />} />
                <Route path="*" element={<ComingSoon title="Page not found" />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

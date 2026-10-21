import { createClient, type Session } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Browser, type Page } from '@playwright/test';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PASSWORD = 'e2e-Password-123';

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

/** Creates a manager and one of their employees. Uses the test project's service-role key, never the real one. */
export async function createTeam(): Promise<{ manager: TestUser; employee: TestUser }> {
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for the test project.');
  }
  const admin = createClient(url, serviceKey, noSession);
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const make = async (name: string): Promise<TestUser> => {
    const email = `${name.toLowerCase()}-${stamp}@e2e.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'createUser failed');
    return { id: data.user.id, email, name };
  };
  const manager = await make('Priya');
  const employee = await make('Alex');
  const promoted = await admin.from('profiles').update({ role: 'manager' }).eq('id', manager.id);
  if (promoted.error) throw new Error(promoted.error.message);
  const assigned = await admin.from('profiles').update({ manager_id: manager.id }).eq('id', employee.id);
  if (assigned.error) throw new Error(assigned.error.message);
  return { manager, employee };
}

async function sessionFor(user: TestUser): Promise<Session> {
  const anon = createClient(url, anonKey, noSession);
  const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: PASSWORD });
  if (error || !data.session) throw new Error(error?.message ?? 'sign-in failed');
  return data.session;
}

/** Opens a page that is already signed in as `user` (the session is placed where supabase-js looks for it). */
export async function openAs(browser: Browser, user: TestUser): Promise<Page> {
  const session = await sessionFor(user);
  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(
    ([storageKey, value]) => window.localStorage.setItem(storageKey, value),
    [key, JSON.stringify(session)],
  );
  return context.newPage();
}

export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

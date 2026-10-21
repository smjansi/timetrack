import { expect, test, type Page } from '@playwright/test';
import { createTeam, expectAccessible, openAs } from './support';

const day = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^${name} `) });

async function addEntry(page: Page, dayName: string, hours: string) {
  await day(page, dayName).getByRole('button', { name: /Add entry/ }).click();
  await page.getByLabel(/^Hours/).fill(hours);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('Entry saved')).toBeVisible();
}

test('employee submits, manager rejects a day, employee fixes and resubmits, manager approves', async ({ browser }) => {
  const { manager, employee } = await createTeam();
  const emp = await openAs(browser, employee);
  const mgr = await openAs(browser, manager);

  // employee: create a week, log two days, submit
  await emp.goto('/');
  await expect(emp.getByRole('heading', { name: 'My Timesheet' })).toBeVisible();
  await expectAccessible(emp);
  await emp.getByRole('button', { name: /New timesheet/ }).click();
  await expect(emp.getByRole('heading', { name: 'Weekly timesheet' })).toBeVisible();
  await addEntry(emp, 'Mon', '6');
  await addEntry(emp, 'Tue', '4');
  await expectAccessible(emp);
  await emp.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(emp.getByText('Timesheet submitted for approval')).toBeVisible();

  // manager: reject Monday (comment required), approve Tuesday
  await mgr.goto('/approvals');
  await expectAccessible(mgr);
  await mgr.getByRole('button', { name: /Alex/ }).click();
  const mon = day(mgr, 'Mon');
  await mon.getByRole('button', { name: 'Reject' }).click();
  await expect(mon.getByText('Add a comment to reject this day.')).toBeVisible();
  await mon.getByLabel('Comment (to reject)').fill('Split the hours');
  await mon.getByRole('button', { name: 'Reject' }).click();
  await expect(mgr.getByText(/Mon .* rejected · Alex/)).toBeVisible();
  await day(mgr, 'Tue').getByRole('button', { name: 'Approve' }).click();
  await expect(mgr.getByText('Timesheet rejected · Alex')).toBeVisible();
  await expect(mgr.getByText('Nothing waiting for review.')).toBeVisible();

  // employee: sees the comment, rejected entry is read-only, adds a corrected entry, resubmits
  await emp.goto('/');
  await emp.getByRole('button', { name: /Manager: .*Split the hours/ }).click();
  await expect(emp.getByText(/Manager comment: .*Split the hours/)).toBeVisible();
  await expect(emp.locator('.chip-rej')).toHaveCount(1);
  await expect(day(emp, 'Mon').getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await addEntry(emp, 'Mon', '6');
  await expect(day(emp, 'Tue').getByRole('button', { name: /Delete/ })).toHaveCount(0); // approved day is locked
  await emp.getByRole('button', { name: 'Resubmit' }).click();
  await expect(emp.getByText('Timesheet submitted for approval')).toBeVisible();

  // manager: approves the corrected Monday, which finishes the timesheet
  await mgr.goto('/approvals');
  await mgr.getByRole('button', { name: /Alex/ }).click();
  await expectAccessible(mgr);
  await day(mgr, 'Mon').getByRole('button', { name: 'Approve' }).click();
  await expect(mgr.getByText('Timesheet approved · Alex')).toBeVisible();

  // employee sees Approved; manager's report shows the entries
  await emp.goto('/');
  await expect(emp.locator('.badge-Approved')).toHaveCount(1);
  await mgr.goto('/reports');
  await expect(mgr.getByText('Entries shown')).toBeVisible();
  await expectAccessible(mgr);
});

test('daily cap is enforced with a clear message', async ({ browser }) => {
  const { employee } = await createTeam();
  const emp = await openAs(browser, employee);
  await emp.goto('/');
  await emp.getByRole('button', { name: /New timesheet/ }).click();
  await addEntry(emp, 'Wed', '6');
  await day(emp, 'Wed').getByRole('button', { name: /Add entry/ }).click();
  await emp.getByLabel(/^Hours/).fill('3');
  await emp.getByRole('button', { name: 'Save entry' }).click();
  await expect(emp.getByRole('alert')).toContainText('cannot exceed 8.5 hours');
  await expectAccessible(emp);
});

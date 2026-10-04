import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * dnd-kit needs real pointer movement (activation distance), not a synthetic drop.
 * Drops ~60px below the target's top edge, or `fromBottom` px above its bottom edge.
 */
async function dragTo(page: Page, source: Locator, target: Locator, { fromBottom }: { fromBottom?: number } = {}) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, fromBottom === undefined ? to.y + 60 : to.y + to.height - fromBottom, { steps: 20 });
  await page.mouse.up();
}

const column = (page: Page, name: string) => page.getByRole('region', { name: new RegExp(`^${name} column`) });
const card = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(`^${title}\\.`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(column(page, 'To do')).toBeVisible();
});

test('dragging a card to Done updates its status and persists after reload', async ({ page }) => {
  const title = 'Audit onboarding funnel drop-off';
  await expect(column(page, 'To do').getByText(title)).toBeVisible();

  await dragTo(page, card(page, title), column(page, 'Done'));

  await expect(column(page, 'Done').getByText(title)).toBeVisible();
  await expect(column(page, 'To do').getByText(title)).toHaveCount(0);

  await page.reload();
  await expect(column(page, 'Done').getByText(title)).toBeVisible();

  // activity feed records the move
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByRole('complementary', { name: 'Activity' })).toContainText('from To do to Done');
});

test('a failed save rolls the card back with an error toast', async ({ page }) => {
  const title = 'Design empty states for dashboards';
  await page.getByText('Simulate failures').click();

  await dragTo(page, card(page, title), column(page, 'In progress'));

  await expect(page.getByRole('alert').filter({ hasText: 'We were unable to move your task. Please try again.' })).toBeVisible();
  await expect(column(page, 'To do').getByText(title)).toBeVisible();
  await expect(column(page, 'In progress').getByText(title)).toHaveCount(0);
});

test('switching to Bob hides private Marketing; switching to Carol redirects her to her own list', async ({ page }) => {
  const sidebar = page.getByRole('navigation', { name: 'Workspace' });
  await expect(sidebar.getByText('Marketing')).toBeVisible();

  await page.getByRole('button', { name: /Current user/ }).click();
  await page.getByRole('menuitem', { name: /Bob Chen/ }).click();
  await expect(sidebar.getByText('Marketing')).toHaveCount(0);
  await expect(sidebar.getByText('Sprint 12')).toBeVisible();

  await page.getByRole('button', { name: /Current user/ }).click();
  await page.getByRole('menuitem', { name: /Carol Diaz/ }).click();
  // Backlog isn't shared with Carol → she lands on Social, no "Access denied"
  await expect(page).toHaveURL(/\/lists\/ls_social$/);
  await expect(column(page, 'Ideas')).toBeVisible();
  await expect(page.getByText('Access denied')).toHaveCount(0);
  await expect(sidebar.getByText('Backlog')).toHaveCount(0);
});

test('lists are linkable: Carol pasting a link to a list she cannot see gets a 403', async ({ page }) => {
  // Alice opens Sprint 12 and "copies" its URL
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'List Sprint 12' }).click();
  await expect(page).toHaveURL(/\/lists\/ls_sprint$/);
  const link = page.url();

  // switch to Carol, then open the link directly
  await page.getByRole('button', { name: /Current user/ }).click();
  await page.getByRole('menuitem', { name: /Carol Diaz/ }).click();
  await page.goto(link);
  await expect(page.getByRole('alert').filter({ hasText: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('region', { name: /column/ })).toHaveCount(0);

  // her own list works by URL, and browser back returns to the denied link
  await page.getByRole('button', { name: 'Go to Social' }).click();
  await expect(page).toHaveURL(/\/lists\/ls_social$/);
  await expect(column(page, 'Ideas')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/lists\/ls_sprint$/);
  await expect(page.getByRole('alert').filter({ hasText: 'Access denied' })).toBeVisible();
});

test('a column emptied by dragging out its last card still accepts drops (near the top too)', async ({ page }) => {
  await page.goto('/lists/ls_sprint');
  await expect(column(page, 'In review')).toBeVisible();

  await dragTo(page, card(page, 'Fix race condition in autosave'), column(page, 'In progress'));
  await expect(column(page, 'In review').getByRole('button', { name: /\. Press Enter/ })).toHaveCount(0);

  // dragTo aims ~60px below the column's top edge, where the first card would go
  await dragTo(page, card(page, 'Add rate limiting to public API'), column(page, 'In review'));
  await expect(column(page, 'In review').getByText('Add rate limiting to public API')).toBeVisible();
});

test('dropping a card in the empty space below its column moves it to the bottom (and it stays there)', async ({ page }) => {
  const todoCards = column(page, 'To do').getByRole('button', { name: /\. Press Enter/ });
  const before = await todoCards.allTextContents();
  const first = (await todoCards.first().getAttribute('aria-label'))!.split('.')[0]!;

  await dragTo(page, todoCards.first(), column(page, 'To do'), { fromBottom: 30 });

  await expect(todoCards.last()).toHaveAccessibleName(new RegExp(`^${first}\\.`));
  await expect(todoCards).toHaveCount(before.length);
  await page.reload();
  await expect(todoCards.last()).toHaveAccessibleName(new RegExp(`^${first}\\.`));
});

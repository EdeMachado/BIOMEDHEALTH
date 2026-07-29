import { test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('Demo@123');
  await page.locator('select').selectOption('org-1');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const viewports = [
  { folder: 'desktop', width: 1440, height: 900 },
  { folder: 'tablet', width: 834, height: 1112 },
  { folder: 'mobile', width: 390, height: 844 },
];

test('captura telas principais dos tres produtos', async ({ page }) => {
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await login(page, 'usuario.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/${vp.folder}/minha-biomed.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sair' }).click();

    await login(page, 'medico.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/${vp.folder}/biomed-clinica.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sair' }).click();

    await login(page, 'gestor.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/${vp.folder}/biomed-gestao.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sair' }).click();
  }
});

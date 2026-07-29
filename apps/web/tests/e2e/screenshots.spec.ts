import { test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('Demo@123');
  await page.locator('select').selectOption('org-1');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const viewports = [
  { folder: 'desktop', width: 1440, height: 900 },
  { folder: 'tablet', width: 768, height: 1024 },
  { folder: 'mobile', width: 390, height: 844 },
];

test('captura telas principais dos tres produtos', async ({ page }) => {
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await login(page, 'usuario.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/minha-biomed-inicio.png`, fullPage: true });
    await page.goto('/minha-biomed/jornada');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/minha-biomed-jornada.png`, fullPage: true });
    await page.goto('/minha-biomed');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/minha-biomed-avaliacao.png`, fullPage: true });

    await login(page, 'medico.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-clinica-painel.png`, fullPage: true });
    await page.goto('/clinica/carteira');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-clinica-carteira.png`, fullPage: true });
    await page.goto('/clinica/ficha');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-clinica-ficha-clinica.png`, fullPage: true });
    await page.goto('/clinica/plano-cuidado');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-clinica-plano-cuidado.png`, fullPage: true });

    await login(page, 'gestor.demo@biomed.health');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-gestao-painel.png`, fullPage: true });
    await page.goto('/gestao/campanhas');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-gestao-campanhas.png`, fullPage: true });
    await page.goto('/gestao/plano-acao');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-gestao-plano-acao.png`, fullPage: true });
    await page.goto('/gestao/auditoria');
    await page.screenshot({ path: `tests/e2e/screenshots/refinement/${vp.folder}/biomed-gestao-auditoria.png`, fullPage: true });
  }
});

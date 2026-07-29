import { expect, test, type Page } from '@playwright/test';

async function login(
  page: Page,
  email: string,
  organization = 'org-1',
  options: { expectSuccess?: boolean } = {}
) {
  const { expectSuccess = true } = options;
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('Demo@123');
  await page.locator('select').selectOption(organization);
  await page.getByRole('button', { name: 'Entrar' }).click();
  if (expectSuccess) {
    await page.waitForURL(/\/(minha-biomed|clinica|gestao)/);
  }
}

test('1) usuario realiza login e avaliacao inicial', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await expect(page.getByText('Minha BioMed - Inicio')).toBeVisible();
  await page.getByLabel('Horas medias de sono').fill('5');
  await page.getByLabel('Dias de atividade fisica por semana').fill('1');
  await page.getByLabel('Nivel de estresse (0 a 10)').fill('9');
  await page.getByLabel(/Aceito o aviso de privacidade/i).check();
  await page.getByRole('button', { name: 'Gerar resultado orientativo' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado orientativo' })).toBeVisible();
});

test('2) usuario ingressa/acompanha jornada', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await page.getByRole('link', { name: 'Jornada' }).click();
  await expect(page.getByText('Minha jornada - Bem-estar e Prevencao')).toBeVisible();
});

test('3) profissional visualiza usuario vinculado', async ({ page }) => {
  await login(page, 'medico.demo@biomed.health');
  await page.getByRole('link', { name: 'Minha Carteira' }).click();
  await expect(page.getByText(/Ana Demo \(vinculada\): acesso permitido/i)).toBeVisible();
});

test('4) profissional nao visualiza usuario nao vinculado', async ({ page }) => {
  await login(page, 'medico.demo@biomed.health');
  await page.getByRole('link', { name: 'Minha Carteira' }).click();
  await expect(page.getByText(/Usuario nao vinculado: acesso negado/i)).toBeVisible();
});

test('5) RH acessa indicador coletivo', async ({ page }) => {
  await login(page, 'gestor.demo@biomed.health');
  await page.getByRole('link', { name: 'Indicadores' }).click();
  await expect(page.getByText('Distribuicao agregada de risco')).toBeVisible();
});

test('6) RH impedido de acessar ficha clinica por URL', async ({ page }) => {
  await login(page, 'gestor.demo@biomed.health');
  await page.goto('/clinica/ficha');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
});

test('7) administrador cliente acessa campanhas', async ({ page }) => {
  await login(page, 'admin.cliente@biomed.health');
  await page.getByRole('link', { name: 'Campanhas' }).click();
  await expect(page.getByRole('heading', { name: 'Campanhas' })).toBeVisible();
});

test('8) auditor consulta eventos em modo somente leitura', async ({ page }) => {
  await login(page, 'auditor.demo@biomed.health');
  await page.getByRole('link', { name: 'Indicadores' }).click();
  await expect(page.getByText('Distribuicao agregada de risco')).toBeVisible();
  await expect(page.getByRole('button', { name: /salvar|editar|excluir/i })).toHaveCount(0);
});

test('rotas protegidas bloqueiam acesso sem sessao', async ({ page }) => {
  await page.goto('/minha-biomed');
  await expect(page).toHaveURL(/\/login$/);
});

test('usuario nao acessa area clinica por URL direta', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await page.goto('/clinica');
  await expect(page).toHaveURL(/\/acesso-negado$/);
  await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
});

test('segregacao por organizacao no login', async ({ page }) => {
  await login(page, 'usuario.org2@biomed.health', 'org-1', { expectSuccess: false });
  await expect(page.getByText(/Credenciais invalidas/i)).toBeVisible();
});

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
  await expect(page.getByText(/Vamos cuidar da sua saúde hoje/i)).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Horas médias de sono').fill('5');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Dias de atividade física por semana').fill('1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nível de estresse (0 a 10)').fill('9');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel(/Aceito o aviso de privacidade/i).check();
  await page.getByRole('button', { name: 'Gerar resultado orientativo' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado orientativo' })).toBeVisible();
});

test('2) usuario ingressa/acompanha jornada', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await page.getByRole('link', { name: 'Jornada' }).click();
  await expect(
    page.getByRole('heading', { name: 'Minha jornada — Bem-estar e Prevenção' })
  ).toBeVisible();
  await expect(page.getByText('Semana 8')).toBeVisible();
});

test('3) profissional visualiza usuario vinculado', async ({ page }) => {
  // Seed explícito via fluxo autorizado do titular (não via leitura clínica).
  await login(page, 'usuario.demo@biomed.health');
  await page.getByRole('link', { name: 'Jornada' }).click();
  await expect(
    page.getByRole('heading', { name: 'Minha jornada — Bem-estar e Prevenção' })
  ).toBeVisible();

  await login(page, 'medico.demo@biomed.health');
  await page.getByRole('link', { name: 'Minha Carteira' }).click();
  await expect(page.getByRole('heading', { name: /Ana Demo • Faixa etária/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir acompanhamento' }).first()).toBeVisible();
  await expect(page.getByTestId('clinical-journey-label-usr-1')).toContainText(/Bem-estar e Prevenção/);
  await expect(page.getByRole('button', { name: /Marcar como concluída/i })).toHaveCount(0);
});

test('4) profissional nao visualiza usuario nao vinculado', async ({ page }) => {
  await login(page, 'medico.demo@biomed.health');
  await page.getByRole('link', { name: 'Minha Carteira' }).click();
  await expect(page.getByText(/Usuário não vinculado/i)).toHaveCount(0);
});

test('5) RH acessa indicador coletivo', async ({ page }) => {
  await login(page, 'gestor.demo@biomed.health');
  await page.getByRole('link', { name: 'Indicadores' }).click();
  await expect(page.getByRole('heading', { name: 'Indicadores analíticos' })).toBeVisible();
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
  await page.getByRole('link', { name: 'Auditoria' }).click();
  await expect(page.getByRole('heading', { name: /Auditoria/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Editar|Excluir|Salvar/i })).toHaveCount(0);
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
  await expect(page.getByText(/Credenciais inv[aá]lidas/i)).toBeVisible();
});

test('menu lateral indica rota ativa', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await page.getByRole('link', { name: 'Jornada' }).click();
  await expect(page.getByRole('link', { name: 'Jornada' })).toHaveClass(/bg-\[var\(--primary\)\]/);
});

test('usuario conclui atividade mock', async ({ page }) => {
  await login(page, 'usuario.demo@biomed.health');
  await page.getByRole('link', { name: 'Atividades' }).click();
  await page.getByRole('button', { name: 'Marcar como concluída' }).first().click();
  await expect(page.getByRole('heading', { name: 'Concluídas' })).toBeVisible();
});

test('agenda clinica aplica filtros demonstrativos', async ({ page }) => {
  await login(page, 'medico.demo@biomed.health');
  await page.getByRole('link', { name: 'Agenda' }).click();
  await page.getByRole('combobox').nth(1).selectOption('concluído');
  await expect(page.getByText('Elisa Fictícia')).toBeVisible();
  await expect(page.getByText('Ana Demo')).toHaveCount(0);
});

test('campanhas executam acao mock sem envio externo', async ({ page }) => {
  await login(page, 'gestor.demo@biomed.health');
  await page.getByRole('link', { name: 'Campanhas' }).click();
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await expect(page.getByText(/modo demonstração/i)).toBeVisible();
});

test('plano de acao coletivo permanece agregado', async ({ page }) => {
  await login(page, 'gestor.demo@biomed.health');
  await page.getByRole('link', { name: 'Plano de Ação' }).click();
  await expect(page.getByRole('heading', { name: 'Plano de ação coletivo' })).toBeVisible();
  await expect(page.getByText('Ana Demo')).toHaveCount(0);
});

# BIOMED HEALTH - Checklist de Seguranca (MVP Demo 1)

## 1) Segredos e configuracao

- [ ] Existe `.env.example` sem valores reais
- [ ] Nenhuma chave/token/senha no codigo-fonte
- [ ] `.env` no `.gitignore`
- [ ] Validacao de variaveis de ambiente na inicializacao

## 2) Autenticacao e sessao

- [ ] Login por e-mail/senha implementado
- [ ] Magic link habilitavel sem refatorar UI
- [ ] Recuperacao de senha implementada
- [ ] Verificacao de e-mail prevista no fluxo
- [ ] Sessao com expiracao e renovacao segura
- [ ] Base preparada para MFA em perfis privilegiados

## 3) Autorizacao e segregacao

- [ ] RBAC por perfil aplicado na aplicacao
- [ ] Escopo por `organization_id` em consultas sensiveis
- [ ] Vinculo profissional-usuario validado em recursos clinicos
- [ ] Gestor institucional bloqueado para dados clinicos individuais
- [ ] Admin cliente sem acesso clinico automatico
- [ ] Auditor somente leitura

## 4) Banco e RLS

- [ ] RLS habilitada em tabelas sensiveis
- [ ] Politicas por organizacao implementadas
- [ ] Politicas por ownership (proprio usuario) implementadas
- [ ] Politicas por vinculo profissional implementadas
- [ ] Politicas de leitura agregada para RH/SST implementadas
- [ ] Testes de negacao de acesso implementados

## 5) Privacidade e LGPD

- [ ] Aviso de privacidade em PT-BR
- [ ] Consentimento versionado com finalidade e base legal
- [ ] Revogacao de consentimento registrada
- [ ] Fluxos de exportacao/correcao/exclusao demonstrativos
- [ ] Sem compartilhamento silencioso entre modulos

## 6) Auditoria

- [ ] Login/logout auditados
- [ ] Falhas relevantes de autenticacao auditadas
- [ ] Visualizacao de dados sensiveis auditada
- [ ] CRUD sensivel auditado
- [ ] Mudanca de permissao auditada
- [ ] Exportacao auditada
- [ ] Upload/download de documentos auditado
- [ ] Sem senha/token/conteudo clinico completo nos logs

## 7) Frontend seguro

- [ ] Sem dados sensiveis em `localStorage`
- [ ] Mensagens de erro sem vazar detalhes internos
- [ ] Validacao de formulario com Zod
- [ ] Escape/sanitizacao para entradas exibidas
- [ ] Guards de rota por perfil e organizacao

## 8) Headers e transporte

- [ ] HTTPS obrigatorio em producao
- [ ] CSP definida para web app
- [ ] HSTS habilitavel
- [ ] X-Content-Type-Options e X-Frame-Options avaliados
- [ ] Politica de referrer definida

## 9) Documentos e storage

- [ ] Bucket privado para documentos
- [ ] URL assinada temporaria para acesso
- [ ] Controle de acesso por perfil/vinculo/organizacao
- [ ] Auditoria de upload/download

## 10) Qualidade e validacao final da fase

- [ ] Lint passando
- [ ] Typecheck passando
- [ ] Testes unitarios/integracao passando
- [ ] E2E prioritarios passando
- [ ] Build de producao passando
- [ ] Sem erro grave de console na demo

-- Casos de teste SQL para SUP-A01/SUP-A03 (deny-by-default e isolamento de tenant).
-- Executar somente em ambiente local isolado com Supabase/psql configurado.
-- Este arquivo define cenarios de validacao esperada; nao deve usar dados reais.

-- 1) Sessao ausente -> negacao
-- expect: select * from organizations; => erro/0 linhas por RLS

-- 2) Usuario sem vinculo ativo -> negacao dados institucionais
-- expect: sem linha em user_organizations para auth.uid()
-- expect: select * from organizations; => 0 linhas

-- 3) Vinculo organizacao A nao acessa organizacao B
-- expect: usuario com vinculo ativo em org-A
-- expect: select * from organizations where id = 'org-B'::uuid; => 0 linhas

-- 4) Unidade indevida bloqueada em user_roles/user_profiles
-- expect: tentativa insert user_roles com unit_id de outra organization => excecao trigger

-- 5) Papel insuficiente bloqueado para administracao de vinculos
-- expect: usuario papel `usuario` tentar insert em user_roles => negado

-- 6) Multiplos papeis validos reconhecidos por vinculos persistidos
-- expect: usuario com dois papeis ativos em user_roles, mesmo tenant => ambas consultas permitidas conforme policy

-- 7) Alteracao do proprio papel bloqueada
-- expect: admin tentando update user_roles cujo user_organization_id pertence ao proprio auth.uid() => negado

-- 8) Alteracao do proprio vinculo/perfil bloqueada
-- expect: admin tentando update/delete em user_organizations/user_profiles do proprio auth.uid() => negado

-- 9) Operacao legitima dentro do tenant permitida
-- expect: admin_cliente/admin_biomed com vinculo ativo no tenant consegue CRUD autorizado em user_organizations/user_roles

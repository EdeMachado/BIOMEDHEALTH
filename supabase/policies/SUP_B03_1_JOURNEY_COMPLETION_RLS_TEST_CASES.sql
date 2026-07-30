-- Casos de teste SQL para SUP-B03.1 corretivo (imutabilidade pos-conclusao).
-- Executar somente em PostgreSQL local descartavel com harness de auth.uid()/claims.
-- NAO representa validacao do stack Supabase gerenciado completo.
-- Diferenca vs testes Vitest: este arquivo exerce RLS/grants reais no Postgres;
-- apps/web/tests/integration/supabaseJourneyRepository.test.ts usa fake client.

-- Pre-condicoes esperadas apos seed harness:
-- - org A/B, usuarios titular A1, titular A2, titular B1
-- - catalogo journey/version/step/activity em A e B
-- - vinculos ativos user_organizations
-- - role authenticated + SET ROLE / request.jwt.claim.sub

-- 1) progresso pode ser criado em jornada ativa pelo titular correto
-- expect: insert user_activity_progress ok

-- 2) progresso pode ser atualizado em jornada ativa pelo titular correto
-- expect: update user_activity_progress ok; unique (user_journey_id, journey_activity_id) preservado

-- 3) conclusao legitima funciona
-- expect: update user_journeys set completed_at=now(), status='concluida' ok enquanto completed_at is null

-- 4) progresso nao pode ser inserido apos conclusao
-- expect: insert em jornada concluida => 0 linhas / erro RLS

-- 5) progresso nao pode ser atualizado apos conclusao
-- expect: update em progresso de jornada concluida => 0 linhas / erro RLS

-- 6) titular nao consegue reabrir jornada concluida
-- expect: update set completed_at=null, status='ativo' => 0 linhas (USING falha)

-- 7) usuario divergente continua sem acesso
-- expect: select/update de jornada/progresso de outro user => 0 linhas

-- 8) organizacao divergente continua sem acesso
-- expect: mesmo user_id sem vinculo ativo na org alvo => negado

-- 9) atividade de outra versao continua rejeitada
-- expect: insert progresso com journey_activity_id de outra journey_version => negado

-- 10) leitura historica permanece funcional
-- expect: select user_journeys/user_activity_progress/catalogo historico do titular ok apos conclusao

-- 11) repeticao idempotente nao cria duplicidade
-- expect: segundo upsert na mesma atividade em jornada ativa atualiza o mesmo registro

-- 12) rollback 0009 restaura policies 0008 e preserva dados
-- expect: count(*) inalterado; policies voltam ao texto 0008; reaplicar 0009 ok

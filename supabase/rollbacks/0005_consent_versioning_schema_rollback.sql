-- Rollback manual SUP-B01.1
-- Estrategia conservadora: interrompe se houver risco de perda de informacao.
-- Nao remove tabelas originais; apenas objetos introduzidos em 0005.

do $$
begin
  if exists (select 1 from public.consent_documents limit 1) then
    raise exception
      'Rollback 0005 bloqueado: consent_documents contem dados; remover colunas causaria perda de informacao.';
  end if;

  if exists (
    select 1
    from public.user_consents
    where revoked_source is not null
       or revoked_reason is not null
    limit 1
  ) then
    raise exception
      'Rollback 0005 bloqueado: user_consents contem metadados de revogacao.';
  end if;
end $$;

drop trigger if exists trg_prevent_user_consents_delete on public.user_consents;
drop function if exists public.prevent_user_consents_delete();
drop trigger if exists trg_guard_user_consents_mutability on public.user_consents;
drop function if exists public.guard_user_consents_mutability();
drop trigger if exists trg_guard_consent_documents_mutability on public.consent_documents;
drop function if exists public.guard_consent_documents_mutability();

drop index if exists public.user_consents_org_revoked_idx;
drop index if exists public.user_consents_org_document_accepted_idx;
drop index if exists public.user_consents_org_user_accepted_idx;

alter table public.user_consents
  drop constraint if exists user_consents_user_org_fk,
  drop constraint if exists user_consents_document_org_fk,
  drop constraint if exists user_consents_revocation_fields_chk,
  drop constraint if exists user_consents_revocation_timeline_chk;

alter table public.user_consents
  drop column if exists revoked_reason,
  drop column if exists revoked_source;

drop index if exists public.consent_documents_org_code_idx;
drop index if exists public.consent_documents_org_effective_idx;

alter table public.consent_documents
  drop constraint if exists consent_documents_content_hash_kind_chk,
  drop constraint if exists consent_documents_content_hash_not_blank_chk,
  drop constraint if exists consent_documents_document_version_not_blank_chk,
  drop constraint if exists consent_documents_validity_window_chk,
  drop constraint if exists consent_documents_id_organization_unique,
  drop constraint if exists consent_documents_unique_code_version;

alter table public.consent_documents
  drop column if exists expires_at,
  drop column if exists effective_at,
  drop column if exists content_hash,
  drop column if exists code;

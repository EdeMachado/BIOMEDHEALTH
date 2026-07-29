# BIOMED HEALTH - Matriz de Perfis e Permissoes (MVP Demo 1)

## Legenda

- L: leitura
- C: criacao
- U: atualizacao
- D: desativacao/exclusao logica
- N/A: nao aplicavel

## Regras transversais

1. Toda operacao sensivel exige `organization_id` valido.
2. Usuario final acessa apenas recursos com `user_id = auth.uid()`.
3. Profissional acessa apenas usuarios formalmente vinculados.
4. Gestor institucional acessa somente dados agregados (sem individuo clinico).
5. Administrador cliente nao recebe acesso clinico por padrao.
6. Auditor e somente leitura em trilhas autorizadas.

## Matriz resumida por dominio

| Dominio/Recurso | Usuario | Medico | Prof. Saude | Gestor Clinico | Gestor Institucional/RH | SST | Admin Cliente | Admin BioMed | Auditor |
|---|---|---|---|---|---|---|---|---|---|
| Proprio perfil e dados cadastrais | L/U (proprio) | L (vinculados quando necessario) | L (vinculados minimamente) | L (minimo necessario) | N/A individual | N/A individual | L/U operacional | L/U | L |
| Consentimentos (historico/aceite/revogacao) | L/C/U (proprio) | L (quando autorizado) | L (quando autorizado) | L | N/A individual | N/A individual | N/A | L/U de documentos base | L |
| Avaliacao inicial (respostas) | L/C/U (proprio) | L (vinculados) | L parcial (vinculados e escopo) | L supervisao | N/A individual | N/A individual | N/A | N/A clinico | L metadado |
| Resultado orientativo de risco | L (proprio) | L (vinculados) | L parcial | L supervisao | L agregado | L agregado ocupacional | L agregado | L agregado | L |
| Ficha clinica | L (proprio resumo permitido) | L/C/U (vinculados) | L/C/U parcial (escopo) | L supervisao | PROIBIDO | PROIBIDO | PROIBIDO por padrao | Nao automatico | L trilha |
| Plano de cuidado | L (proprio) | L/C/U (vinculados) | L/C/U parcial | L/U supervisao | PROIBIDO individual | PROIBIDO individual | PROIBIDO | Nao automatico | L trilha |
| Agenda e atendimentos | L/C/U (proprio) | L/C/U (vinculados) | L/C/U (vinculados) | L/U | L agregado | L agregado | L/U operacional | L/U | L |
| Jornadas e atividades | L/C/U (proprio progresso) | L (vinculados) | L/U apoio (vinculados) | L supervisao | L agregado | L agregado | L/U operacional | L/U | L |
| Campanhas | L | L (visao) | L (visao) | L (visao) | L/C/U/D | L/C/U (ocupacional) | L/C/U/D | L/C/U/D | L |
| Indicadores coletivos | L limitado | L limitado | L limitado | L supervisao | L | L | L | L | L |
| Configuracoes organizacionais | N/A | N/A | N/A | N/A | L limitado | L limitado | L/C/U | L/C/U/D | L |
| Auditoria | L dos proprios eventos | L conforme autorizacao | L conforme autorizacao | L | L eventos gerenciais | L ocupacional | L administrativo | L total autorizado | L somente leitura |

## Regras criticas que devem ser testadas

1. Gestor institucional nao acessa ficha clinica individual.
2. Profissional nao acessa usuario fora de seu vinculo.
3. Usuario nao acessa dado de outro usuario.
4. Usuario de organizacao A nao acessa organizacao B.
5. Admin cliente nao herda acesso clinico.
6. Auditor nao altera dados.

## Observacoes de implementacao

- Implementar permissao em dois niveis:
  1) aplicacao (guardas de rota/use-cases)
  2) banco (RLS)
- Nao confiar apenas no frontend para bloqueio.
- Toda negacao deve gerar evento de auditoria com motivo.

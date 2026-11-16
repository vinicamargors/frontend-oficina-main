# Fase 6.1 (front) — categorias de estoque no servidor

Auditoria independente (agente Playwright, sem editar `src/`), backend simulado (`e2e/mocks`).

| ID | Cenário | Resultado |
|----|---------|-----------|
| F61 | Criar categoria: POST `{nome: 'LANTERNAGEM'}`, aparece no select de "Nova peça", peça salva com a categoria em maiúsculas | passa |
| F61 | Nome já existente (outra caixa/acento) não cria nem duplica; mostra "já existe" | passa |
| F61 | Excluir categoria com itens: confirmação sem escrita; depois uma chamada DELETE só (sem PUT por item) | passa |
| F61 | Erro do servidor ao excluir/criar (400/500): `role=alert` dentro da folha, sem diálogo nativo, nome digitado mantido | passa |
| F61 | Migração do `localStorage`: sobe só o que o servidor não tem; chave some; se o POST falha a chave fica e a tela carrega | passa |
| F61 | Offline / carga lenta: aviso e skeleton, sem travar; 390 e 1440 px, claro e escuro, sem estouro lateral | passa |
| F61 | Só as categorias falham (500): peças continuam na lista, categorias derivadas das peças, aviso visível | passa (corrigido após a auditoria) |
| F61 | Depois de excluir categoria o foco fica no campo "Nome da nova categoria" | passa (corrigido após a auditoria) |

Achados do auditor e o que foi feito:
- importante — falha só nas categorias escondia as peças (parecia estoque vazio): corrigido, chamadas tratadas separadamente + teste;
- médio — foco ia para "Pular para o conteúdo" após excluir (a recarga desmontava a folha): corrigido, atualiza o estado local e foca o campo + teste;
- médio — falha na recarga pós-exclusão sem feedback: some junto com a correção anterior (não há mais recarga);
- cosmético — botão "Categorias (0)" clicável durante a carga: desabilitado enquanto carrega;
- cosméticos sem mudança: migração silenciosa se falhar (a chave fica e tenta de novo); erro continua na folha até a próxima ação.

Suítes: vitest 303/303; e2e `estoque.spec.ts` 118/118 nos 4 projetos. Não verificado: nada contra o backend real nem o banco.

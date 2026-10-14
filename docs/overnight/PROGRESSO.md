# Progresso do plano noturno

Especificação: `docs/overnight/PLANO.md`. Atualizar a cada item concluído.

## Estado atual

- Início: 2026-10-13 23:25 (-03).
- Fase 1 concluída no que dá para fazer sem o Lucas. Em andamento: Fase 2 (medir antes de mexer).

## Status por item

| Item | Status | Commits | Notas |
| --- | --- | --- | --- |
| 1. Sync remoto | feito (validar no device) | e2558b9, 006e95d, 3b3f486 | Motor `@cortex/sync-engine` roda no JS do app com runtime mobile; telas de vínculo E2E, versões, lixeira, conflitos, logs, dispositivos, comentários e presença com dados reais. Convites e links de nota ficam para o item 5. |
| 2. Editor (Mermaid, desenhos, PDF) | feito (parcial em desenhos) | e5cc5da | Mermaid renderizado sob demanda na WebView com o mesmo renderer do desktop, agora em `@cortex/editor/mermaid`. Desenho vira card só de leitura (contagem de formas). PDF: lista no Files e visualizador nativo (WKWebView no iOS, "abrir com" no Android). |
| 3. Interface pura | feito | be09d92, 4b8eeed, 46c3267, bc2a0c6, f303f60, bbcc886 | Tabs: fixar, fechar outras, fechar à direita, reabrir fechada, ordem MRU. Paleta: ~45 comandos do app com os mesmos ids do desktop, mais os comandos do editor/formatação via bridge. Daily notes (na página Templates, como no desktop) e Excluded paths na semântica do desktop. Recuperar senha (deep link `cortex://reset-password`), trocar senha, nova recovery key. Menções não vinculadas via `findPhrase` do índice. |
| 4. Arquivos nativos | feito (PDF depende do item 8) | cf544e8, ef54b4b, e1e9f14 | `dialog.pickFile/pickFiles` com `expo-document-picker` (os arquivos vão para `Documents/Cortex/.picked`, que é app storage); importação sem fixtures (arquivos, CSV, HTML e Obsidian pelo seletor de pasta). Exportação grava o arquivo de verdade (HTML, CSV, PDF via `expo-print`) e abre o share sheet com o MIME/UTI certo. Imagem: item "Image" da toolbar abre a galeria; colar imagem no editor funciona via `saveImage` na bridge (base64). A pasta da imagem segue `editor.imageStorageLocation`, como no desktop. |
| 5. APIs de compartilhamento | feito (validar no device) | e1fffcd, 35dee7a, 6846184, 4508189, e0b8530 + grupos | Os serviços já existiam em `@cortex/sync-api`, e o servidor (`../sync`, Go) já tem os endpoints; faltava ligar no mobile. Links públicos de nota (bundle com imagens embutidas, sem DOMParser), convites, papéis, remoção, convidado restrito a uma nota (grant no caminho), grupos (criar e apagar), templates de equipe (`refreshTeamTemplates`), marketplace de templates (`listMarketTemplates` e `openPublicTemplate`), publicar template de database, abrir `cortex://s/…`, `cortex://invite/…` e `cortex://t/…`. |
| 6. Colaboração em tempo real | feito (validar no device) | e6116d7 | Transporte do core (`createCollabTransport`) no lado React Native, com o WebSocket do RN. A sessão Yjs do core roda no React Native e a WebView tem um Y.Doc espelho ligado ao CodeMirror (`collab` do `EditorView`). Pela bridge passam só updates incrementais, agrupados em 16 ms com `Y.mergeUpdates`; o cursor vai como campo `cursor` do awareness e os estados dos pares vão codificados. Reconexão e offline ficam com a sessão do `@cortex/collab`. |
| 7. Lembretes | feito (validar no device) | 3481b7f, 97bd347 | `platform.notifications` com `expo-notifications`: permissão, envio imediato, `schedule(scope, …)` com diff (cancela só o que mudou), categorias com as ações do core, canal Android "reminders", ativação, inclusive em cold start. Opção `tasks` no `startAppRuntime` do core: o mobile liga o `startTasksRuntime` sem a indexação eager; o índice de tarefas é montado 4 s depois de abrir o vault. |
| 8. Pontuais | feito (dev build / validar no device) | dc6cf98, 075f66c, 56a71c3 | Assinatura: interface `PurchaseProvider` com `web-checkout` real (abre a cobrança no navegador do app e reconsulta o status ao voltar); IAP/Play só pela interface. Módulo Expo local `modules/cortex-native`: bookmarks security-scoped no iOS e permissão persistente no Android, mais extração de texto de PDF (PDFKit / PdfBox-Android). Android: refresh do vault SAF ao voltar ao app. |
| Fase 2: API | em andamento | | |
| Fase 2: desktop | pendente | | |

## Decisões

- Não crio arquivos de teste novos: regra persistente do Lucas no cortex-app.
- Mudanças não commitadas de outra sessão ficam intocadas. Commito com um índice temporário (`GIT_INDEX_FILE`) só com os meus caminhos, e o `bun.lock` entra por patch filtrado.
- Desktop tratado como Electron (branch `refactor/tauri-to-electron`).
- **Sync no mobile:** o `SyncEngine` roda direto na thread JS (o Hermes não tem worker), atrás do mesmo contrato `Platform["sync"]` do desktop. O `SyncRuntime` mobile usa:
  - **Banco:** `expo-sqlite` síncrono. O banco fica em `Documents/Cortex/sync/<rootId>.db`, fora do vault, porque SQLite não abre em pastas SAF/externas.
  - **Arquivos:** os helpers lógicos de `platform/fs`. Em vaults `file://` o acesso é direto, sem listar diretórios a cada segmento.
  - **Criptografia:** `@noble/ciphers`, `@noble/curves` e `@noble/hashes`, as mesmas libs auditadas que `@cortex/collab` já usa; argon2id com `asyncTick` para não travar a UI; gzip com `fflate`, que já era dependência.
- **Background:** em `AppState` background o motor para (flush) e volta com o mesmo `start` no foreground. Sem polling extra.
- **Mudanças locais:** os writes do `fsApi` avisam o motor por `syncSignals` (evento, não watcher).
- **Conta:** o `serverApi` mobile passou a ter `keyCrypto`, `createInviteKeyLink` e `storeInviteKey`, como no desktop. Login com KDF e identidade E2E agora funcionam no celular.
- **Vínculo de vault:** usa o `createVaultKeyFlow` do core (setup de chaves, recovery key, aguardando acesso, senha legada), igual ao desktop. A senha do protótipo antigo saiu porque não existe no protocolo.
- **Versões do servidor:** baixa as 20 mais recentes com concorrência 4 e cache em memória; restaurar guarda a versão atual antes (`captureCurrentNoteVersion`), igual ao desktop.
- **Conflitos:** a chave é o caminho relativo, como no core (antes o mobile usava o caminho absoluto, um bug). Há um banner na nota que abre a tela de conflito.

- **Mermaid:** o renderer saiu de `apps/desktop/src/features/mermaid/mermaidRenderer.ts` para `packages/editor/src/mermaidRenderer.ts`; no desktop ficou um re-export, então nenhum import mudou. O tema vem das variáveis CSS da raiz `.mobile-code-mirror-root`. `mermaid` e `dompurify` só carregam via `import()` quando aparece um bloco.
- **Desenhos no mobile:** card só de leitura. Editar exigiria o Excalidraw (vários MB, fontes por CDN) dentro da WebView. Ver PENDENCIAS.
- **PDF:** o desktop abre PDF numa aba com pdfjs. No mobile, native first: WKWebView renderiza PDF nativamente no iOS; no Android abre o leitor do sistema via `expo-sharing`. Isso evita incluir o pdfjs no bundle.

- **Paleta:** os comandos do editor vivem na WebView, e importar as fábricas no lado React Native puxaria o CodeMirror. A WebView anuncia `{id, label, category, aliases}` pela bridge (`editorCommands`), e o lado nativo registra proxies que chamam `workspaceChannel.sendCommand`.
- **Bug corrigido:** o `SignInSheet` tratava o retorno de `login`/`register` (que é a recovery key) como mensagem de erro. Agora mostra a recovery key para o usuário guardar.
- **Fora do mobile:** comandos que dependem de split, zoom, janelas e atalhos de teclado do desktop ficaram de fora porque não existem no celular.

- **Bug corrigido:** o export antigo compartilhava `renderMarkdownExportHtml(...)` sem `await`, ou seja, enviava "[object Promise]".
- **Importar PDF** precisa da extração de texto (item 8). Até lá, a prévia diz que não está disponível no aparelho, em vez de mostrar páginas falsas.

- **Links no mobile:** o expo-router perderia o hash (`#k=` carrega a chave da nota ou do convite). Por isso `app/+native-intent.tsx` converte os links `cortex://` com os parsers do core em rotas nativas (`/shared-note`, `/invite`, `/public-template`).
- **Telas do marketplace:** `MarketplaceScreen`/`MarketplaceDetailScreen` têm mudanças não commitadas de outra sessão. Mudei só os adapters, mantendo as assinaturas, e deixei `marketplaceFixtures.ts` como reexport de tipos para não quebrar os imports daquelas telas.
- **Edição de grupos** (membros do grupo, regras de acesso por pasta) ficou fora: o mobile não tem referência de UX para isso. Criar e apagar já funcionam.

- **Collab no mobile:** enquanto o espelho está ligado, a WebView não faz commit do texto, porque a persistência do collab grava pelo `noteCache.writeLive`. Isso evita aplicar a mesma edição duas vezes (diff mais Yjs). As transações vindas da bridge entram como origem rastreada do UndoManager, então a persistência as trata como edição local.
- `yjs` e `y-protocols` foram adicionados ao mobile nas mesmas versões fixas do `@cortex/collab` (uma única cópia no `node_modules/.bun`), para não quebrar o `instanceof` do Yjs.

- **Sobras do item 1 resolvidas** (`46a2117`, database): o "Add vault" remoto usa as chaves E2E reais (senha da conta, recovery key, pedido de chave ao admin, senha legada) e o progresso vem de `initialSyncProgress`. Saíram as fixtures de templates de linha de database e de presets de equipe.
- **Lembretes no iOS:** o limite de 64 notificações pendentes vira 60 agendadas, sempre as mais próximas. O core replaneja a cada 30 min e a cada mudança de tarefa.

- **PDF no Android:** PdfBox-Android (Apache 2.0, ~3 MB) em vez de OCR (ML Kit é mais pesado e erra em PDF com texto) ou de não suportar. O `PdfRenderer` do Android só gera bitmap. A lib só entra no build Android do módulo.
- **Assinatura:** o provedor padrão é o checkout web (já existe no servidor). Escolher entre IAP e checkout web, e configurar product IDs, ficou em PENDENCIAS.
- **Módulo nativo:** é opcional em runtime (`requireOptionalNativeModule`). No Expo Go tudo continua funcionando como antes; num dev build os recursos ligam sozinhos.

## Próximo passo exato

Fase 2, API: o servidor está em `../sync` (Go, outro repositório, com mudanças não commitadas de outra sessão). Medir os endpoints de sync e listagem (`/changes`, listagem de vaults, membros) com os testes/benchmarks que existirem lá antes de mexer; se não der para medir sem subir infraestrutura, registrar em PENDENCIAS e seguir para o desktop (`bun run perf`).

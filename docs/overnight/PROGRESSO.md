# Progresso do plano noturno

Especificação: `docs/overnight/PLANO.md`. Atualizar a cada item concluído.

## Estado atual

- Início: 2026-10-13 23:25 (-03).
- Item em andamento: 3. Interface pura.

## Status por item

| Item | Status | Commits | Notas |
| --- | --- | --- | --- |
| 1. Sync remoto | feito (validar no device) | e2558b9, 006e95d, 3b3f486 | Motor `@cortex/sync-engine` roda no JS do app com runtime mobile; telas de vínculo E2E, versões, lixeira, conflitos, logs, dispositivos, comentários e presença com dados reais. Convites e links de nota ficam para o item 5. |
| 2. Editor (Mermaid, desenhos, PDF) | feito (parcial em desenhos) | e5cc5da | Mermaid renderizado sob demanda na WebView com o mesmo renderer do desktop, agora em `@cortex/editor/mermaid`. Desenho vira card só de leitura (contagem de formas). PDF: lista no Files e visualizador nativo (WKWebView no iOS, \"abrir com\" no Android). |
| 3. Interface pura | em andamento | | |
| 4. Arquivos nativos | pendente | | |
| 5. APIs de compartilhamento | pendente | | Inclui convites, links de nota e templates de equipe (`collabAdapter`, `membersAdapter`, `shareAdapter`, `templatesAdapter` ainda com stubs). |
| 6. Colaboração em tempo real | pendente | | |
| 7. Lembretes | pendente | | |
| 8. Pontuais | pendente | | |
| Fase 2: API | pendente | | |
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

## Próximo passo exato

Item 3: comparar a paleta de comandos mobile (`apps/mobile/src/app/command-palette.tsx`) com o registro de comandos do desktop (`apps/desktop/src/bootstrap/appCommands.ts`, `@cortex/commands`) e registrar no mobile os comandos que fazem sentido (navegação voltar/avançar, reabrir tab fechada, daily note etc.).

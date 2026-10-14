# Plano noturno — Cortex Mobile + melhorias

Fonte: pedido do Lucas em 2026-10-13. Este arquivo é a especificação; o estado vive em `PROGRESSO.md`.

## Adaptações ao repositório (decididas antes de começar)

- **Testes:** a regra persistente do Lucas é não criar arquivos de teste no cortex-app. Valido só com os testes que já existem, typecheck, lint e build.
- **Desktop:** na branch `refactor/tauri-to-electron` o desktop é Electron, não Tauri. "Mover para Rust" vira "mover para o main process ou para workers"; "IPC" é o IPC do Electron.
- **Mudanças de outro agente:** o working tree tem mudanças não commitadas de outra sessão (apps/desktop, apps/web, packages/*, docs/community, bun.lock e `apps/mobile/src/features/marketplace/*`). Não são desta sessão: **nunca commitar nem reverter**. Commitar sempre com `git commit -- <caminhos>`, só com arquivos editados por mim. Se um item exigir editar um arquivo que já tem mudança alheia, registrar como bloqueado em `PENDENCIAS.md`.
- **Commits:** `git -c user.name="furqas" -c user.email="lucashernandes401@gmail.com" commit -m "<type>(<scope>): <subject>" -- <paths>`, só com a linha de assunto, sem corpo, sem Co-Authored-By e sem push.
- **Validação mobile:** `bun run check:mobile` mais `cd apps/mobile && bunx expo export -p ios -p android --output-dir <scratch>`. Para pacotes: `bun run --filter <pkg> typecheck` e os testes vitest existentes.
- **Regras de UI mobile:** ver `apps/mobile/AGENTS.md` (Host/RNHostView, splits `.ios`/`.android`, nada chamado `Symbol`, sem cor de fundo no header do iOS, sheets com header nativo).

## Modo de operação

Autônomo e sem perguntas. Decisões do Lucas vão para `PENDENCIAS.md`. Ler `PROGRESSO.md` antes de tudo e atualizá-lo a cada item. Nunca deixar a build quebrada.

Critérios, em ordem: correção, padrões do projeto (reaproveitar `@cortex/*`), native first, performance (RAM/CPU, listas virtualizadas, eventos em vez de polling, I/O incremental), simplicidade (SDK do Expo antes de lib de terceiros).

Proibido: push, deploy, publicação, force-push, reescrever histórico, apagar algo fora do repositório.

## FASE 1 — Pendências do app mobile

1. Sync remoto: motor de `@cortex/sync-engine` com runtime mobile (expo-sqlite, expo-secure-store, cripto do core); telas reais (vínculo/E2E, versões e restauração, lixeira e conflitos, logs e dispositivos, comentários e presença); background guiado por AppState.
2. Editor na WebView: Mermaid, desenhos, embeds e visualizador de PDF, todos lazy.
3. Interface: paleta de comandos com paridade do desktop (~70), tabs (fixar, fechar outras, MRU), Daily notes e Excluded paths, recuperar senha e recovery key, menções não vinculadas reais.
4. Arquivos nativos: document-picker, image-picker, sharing, file-system e print; imagem na nota, importação (arquivos, PDF, Obsidian), exportação real.
5. APIs de compartilhamento: convites, papéis, grupos, convidados, links de nota, nota compartilhada, templates de equipe e do marketplace.
6. Colaboração em tempo real: transporte do `@cortex/collab` ligado à WebView com batching, reconexão e offline.
7. Lembretes: expo-notifications mais agendador local (validar no device).
8. Pontuais: abstração de assinatura; bookmarks security-scoped no iOS (módulo Expo); watcher no Android; extrator de texto de PDF (PDFKit; decidir o Android).

## FASE 2 — Melhorias (medir antes e depois)

- API: N+1, índices, paginação, payloads, compressão, cache; contratos de resposta consistentes e tipos compartilhados.
- Desktop: re-renders, virtualização, trabalho pesado em workers, IPC enxuto, startup, watchers. Métricas: RAM ociosa, abrir vault grande, busca, troca de nota (`bun run perf`).

## Ao parar

`PROGRESSO.md` com o status por item, as decisões e o próximo passo exato. `PENDENCIAS.md` só com o que depende do Lucas.

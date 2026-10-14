# Pendências para o Lucas

Só o que depende de você. Cada item traz o contexto e a recomendação.

## 1. Mudanças não commitadas de outra sessão (bloqueia a consistência do histórico)

- **Contexto:** o working tree tem mudanças em stage e fora de stage que não são desta execução:
  - o `@cortex/sync-engine` virou agnóstico de plataforma (`runtime.ts`, `bytes.ts`, `configureSyncRuntime`) e o worker foi movido para `apps/desktop/electron/syncWorker.ts`;
  - além de `apps/web`, `packages/core`, `packages/marketplace`, `docs/community`, parte do `bun.lock` (`@cortex/marketplace` no web) e `apps/mobile/src/features/marketplace/*`.
- **Impacto:** o commit `e2558b9` (sync no mobile) **depende** dessa refatoração do `sync-engine`, que ainda não está commitada. O working tree compila, mas `e2558b9` isolado não compila.
- **Recomendação:** commitar a refatoração do `sync-engine`/desktop (sessão dona ou você) antes de qualquer push. Se quiser o histórico bisectável, reordene antes do push. Eu não reescrevo histórico.

## 2. Sync no mobile: validar no device

- **Contexto:** o motor roda no JS do app com `expo-sqlite`, `expo-secure-store` e a criptografia `@noble`. Tudo compila e o bundle iOS fecha, mas nada disso roda sem aparelho.
- **Validar:**
  - login com uma conta E2E (argon2id de 64 MiB em JS: medir o tempo);
  - vincular o vault (fluxo de chaves);
  - primeira sincronização;
  - editar no desktop e ver no celular;
  - conflito, versões, lixeira;
  - app em background e de volta.
- **Recomendação:** se o argon2id passar de ~5 s no iPhone, trocar por um módulo nativo (exige dev build). Já existem libs Expo com Argon2 nativo.

## 3. SSE em tempo real no React Native

- **Contexto:** o `fetch` global do React Native não expõe `response.body` em stream. O `SseClient` do motor cai no fallback de polling de 30 s quando o SSE não conecta, então o sync funciona, só que não é instantâneo.
- **Recomendação:** adicionar `fetch?: FetchLike` em `SyncEngineDeps`, repassar para os dois `new ApiClient(...)` em `packages/sync-engine/src/engine.ts` e passar `expo/fetch`, que tem stream, no mobile. Não fiz porque `engine.ts` tem mudanças não commitadas de outra sessão.

## 4. Build de produção do editor (DOM component)

- **Contexto:** `bunx expo export` falha com `Asset not found: _expo/static/js/web/__common-*.js` ao exportar o `WorkspaceWebView` ("use dom"). O erro já existia antes desta execução e vem dos chunks assíncronos (runtime lazy do CodeMirror e agora o Mermaid). No dev (Expo Go + Metro) funciona.
- **Recomendação:** antes de um build de loja, validar o export do DOM component num dev build. Se continuar, desligar o split de chunks só para o DOM bundle (opção de bundle splitting do Metro web) ou servir os chunks como assets.

## 5. Editar desenhos no celular

- **Contexto:** o desktop edita desenhos com o Excalidraw. No mobile mostro um card só de leitura com o número de formas.
- **Recomendação:** decidir se vale levar o editor para o celular. Seria lazy na WebView, mas o pacote é grande e busca fontes por CDN; uma prévia em SVG estático exige o mesmo pacote.

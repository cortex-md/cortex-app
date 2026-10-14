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

## 6. Dev build do mobile (destrava vários itens)

- **Contexto:** dependem de um dev build (`expo-dev-client`) e não rodam no Expo Go:
  - o módulo local `apps/mobile/modules/cortex-native` (bookmarks do iOS, permissão persistente do Android, texto de PDF);
  - lembretes confiáveis (`expo-notifications` com ações);
  - o argon2id nativo, se o de JS ficar lento.
- **Recomendação:** criar o perfil `development` no EAS e gerar um build interno para iOS e Android.
- **Validar no device:**
  - abrir uma pasta externa, matar o app e reabrir: deve abrir direto, sem "Reauthorize";
  - importar um PDF;
  - receber um lembrete e usar as ações (concluir, adiar);
  - colaborar em tempo real com o desktop na mesma nota.

## 7. Assinatura no celular (provedor, contas e product IDs)

- **Contexto:** a camada `features/billing/purchaseProvider.ts` tem a interface (`app-store`, `play-billing`, `web-checkout`) e o checkout web funcionando: abre `BILLING_URL` e reconsulta o status ao voltar.
- **Decisões suas:**
  - usar IAP (App Store / Play Billing) ou só o checkout web; a Apple restringe link externo para compra digital fora de apps "reader";
  - contas de loja, product IDs, preço por região;
  - se for IAP, escolher a lib (`expo-iap` ou RevenueCat) e a validação de recibo no servidor (`../sync`).
- **Recomendação:** checkout web para o lançamento em países onde a regra de link externo permite, e RevenueCat se o IAP for obrigatório, porque simplifica a validação de recibos dos dois lados.

## 8. Fluxos sem referência de UX no celular

- **Contexto:** ficaram de fora porque não têm desenho para o mobile:
  - editar membros de um grupo e as regras de acesso por pasta (só criar e apagar grupo está feito);
  - editar desenhos;
  - escolher a pasta de destino ao baixar um template público.
- **Recomendação:** desenhar no protótipo "Next" antes de implementar.

# Cortex Mobile

## Expo SDK 56

- Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before changing Expo APIs.
- Keep this app native-first: Expo Router nested `Stack` headers, the mobile sidebar/drawer,
  gestures, platform colors, iOS glass/material behavior, and Material/UIKit defaults should own the
  shell.
- `@cortex/core` and `@cortex/properties` are wired for local-first vaults selected through native
  directory picking.
- Phase 3 wires `@cortex/editor`, `@cortex/commands`, and `@cortex/plugin-host-core` only through
  the mobile editor DOM boundary. Do not import CodeMirror or editor runtime values from native
  React Native screens.

## UI Rules

- Use `@expo/ui` universal components for settings-style grouped controls, toggles, sliders,
  buttons, menus, and similar native controls.
- The main workspace follows the Inkdown mobile shell as a visual/UX reference only: calm
  onboarding before any shell, workspace switcher at the top of the drawer, icon action bar,
  Lucide file tree rows, and long-press bottom sheets. Do not import Inkdown code or business
  logic.
- Do not use `@expo/ui` `TextInput` in mobile forms until the Android Expo Go view-config warnings
  are resolved. Use the app-local React Native `MobileTextField` wrapper for onboarding and sheets.
- Do not import `@cortex/ui`; desktop/web primitives are not mobile shell components.
- Do not add Tauri, IPC, Node, browser DOM, or desktop-only platform imports to native React Native
  screens.
- Do not use `SafeAreaView` for route chrome. Let Expo Router native tabs/stacks and automatic
  content insets own safe areas; scroll screens should use
  `contentInsetAdjustmentBehavior="automatic"`.
- Future large note lists should use virtualized React Native list surfaces, not `@expo/ui` `List`.
- Note lists use React Native virtualized lists. Use `@expo/ui` for sheets, grouped controls,
  settings rows, and other native controls around those lists.
- Native note actions should live in stack header actions, gestures, context sheets, and swipe
  affordances. Keep large note collections on `FlatList`.

## App Gate and Onboarding

- `MobileAppGate` owns startup: platform runtime, app info, first-run marker, recents, and the
  app-local `lastActiveVaultPath` file under the mobile app data directory.
- If no vault opens during startup, render only `MobileOnboardingScreen`. Do not mount the sidebar,
  stack shell, file list, or workspace chrome before onboarding completes.
- Mobile onboarding should stay calm and focused: pick a vault folder, collect vault identity
  (name, color, icon), save basic sync preferences through core, then open the pending welcome note.
- The sidebar is workspace-only. Vault creation/opening belongs in onboarding and vault-switcher
  flows, not in an empty notes list.

## Editor Boundary

- The mobile Markdown editor is a DOM Component/WebView boundary. Keep `MobileCodeMirrorEditor`
  isolated behind a `"use dom"` file.
- In Expo Go, pass `dom.useExpoDOMWebView = false` and keep `react-native-webview` as a direct
  dependency so the editor does not require `ExpoDomWebViewModule`.
- Native screens pass only serializable props/actions into the DOM editor. Top-level async functions
  are allowed; nested functions, class instances, CodeMirror extensions, plugin objects, and stores
  must not cross the bridge.
- `MobileCodeMirrorEditor` owns CodeMirror, editor CSS, toolbar/slash UI that depends on selection,
  and plugin `editor:extensions` fixture loading inside the DOM/WebView context.
- Native `NoteEditorScreen` owns note loading, revision tracking, `projectRawNote`,
  `replaceFrontmatterBody`, and debounced bridge commits. It must pass only Markdown body text into
  CodeMirror.
- CodeMirror extensions, editor views, plugin modules, command functions, stores, and class
  instances must stay inside the DOM context; never pass them across the bridge.
- Native screen chrome, sidebar, settings, search, global actions, and navigation stay native.
  Selection toolbar, slash menu, and editor context menu belong inside the DOM editor once
  CodeMirror lands.
- Markdown formatting command metadata lives in `@cortex/editor/markdown-format-commands`.
  `apps/mobile` may register those commands inside the DOM editor context, but must not keep a
  second mobile-only command catalog.

## Development Scripts

- From the repository root, prefer `bun run mobile:start`, `bun run mobile:ios`, and
  `bun run mobile:android` for Expo entry points.
- Use `bun run check:mobile` for the deterministic mobile gate: Expo lint plus TypeScript.
- Use `bun run doctor:mobile` after React-facing mobile changes. Use `bun run doctor:mobile:full`
  only for intentional broader cleanup.

## Platform Adapter

- `src/platform/expo-platform.ts` must implement the full `@cortex/platform` shape.
- Mobile vaults use logical Cortex paths such as `/mobile-vaults/<uuid>`. The Expo adapter owns the
  persisted root map from logical path to native `file://` or Android `content://` directory URI.
  Shared stores and screens must not treat provider URIs as vault paths.
- App-data `file://` paths are not mobile vault paths. Adapter path guards must classify app
  storage before calling `normalizeMobileVaultPath`.
- Android `content://` vault roots cannot be watched with Expo FileSystem in Expo Go. Return a
  no-op watcher and rely on manual refresh until a platform-specific watcher exists.
- `dialog.pickFolder` is implemented with `Directory.pickDirectoryAsync()`. Android should reopen
  through persistable URI grants. iOS scoped directory access may need reauthorization after restart;
  surface that as an explicit reauthorize/open-folder state instead of silently falling back.
- Keep remote sync engine, marketplace, and community plugin discovery out of this foundation pass.
  Import/export contracts may be present on the platform shape, but unsupported mobile methods,
  including native PDF text extraction, should reject clearly until native document picker/share
  flows are implemented.
- Methods that are not real yet should reject clearly or return an explicit unsupported state. Never
  silently fake keychain, remote vault, search, or storage success. `sync.updateSyncPreferences` is
  the narrow exception: it resolves as a no-op on mobile so core can persist local preferences while
  the remote sync engine remains unsupported.

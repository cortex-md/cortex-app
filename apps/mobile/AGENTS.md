# Cortex Mobile

## Expo SDK 56

- Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before changing Expo APIs.
- Keep this app native-first: Expo Router `NativeTabs`, nested `Stack` headers, gestures, platform
  colors, iOS glass/material behavior, and Material/UIKit defaults should own the shell.
- `@cortex/core` and `@cortex/properties` are wired for sandbox-only local vaults.
- Phase 3 wires `@cortex/editor`, `@cortex/commands`, and `@cortex/plugin-host-core` only through
  the mobile editor DOM boundary. Do not import CodeMirror or editor runtime values from native
  React Native screens.

## UI Rules

- Use `@expo/ui` universal components for settings-style grouped controls, toggles, sliders,
  buttons, menus, and similar native controls.
- Do not import `@cortex/ui`; desktop/web primitives are not mobile shell components.
- Do not add Tauri, IPC, Node, browser DOM, or desktop-only platform imports to native React Native
  screens.
- Do not use `SafeAreaView` for route chrome. Let Expo Router native tabs/stacks and automatic
  content insets own safe areas; scroll screens should use
  `contentInsetAdjustmentBehavior="automatic"`.
- Future large note lists should use virtualized React Native list surfaces, not `@expo/ui` `List`.
- Phase 1 note lists use React Native virtualized lists. Use `@expo/ui` for sheets, grouped controls,
  inputs, settings rows, and other native controls around those lists.
- Native note actions should live in stack header actions, gestures, context sheets, and swipe
  affordances. Keep large note collections on `FlatList`.

## Editor Boundary

- The mobile Markdown editor is a DOM Component/WebView boundary. Keep `MobileCodeMirrorEditor`
  isolated behind a `"use dom"` file.
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
- Native screen chrome, tabs, settings, search, global actions, and navigation stay native. Selection
  toolbar, slash menu, and editor context menu belong inside the DOM editor once CodeMirror lands.
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
- Phase 1 filesystem and vault methods are app-sandbox-only and should validate paths under
  `Paths.document/Cortex`.
- Do not add import/export, file pickers, directory pickers, document-provider access, or external
  storage permission prompts in the local-vault phase.
- Methods that are not real yet should reject clearly or return an explicit unsupported state. Never
  silently fake sync, keychain, remote vault, or search success.

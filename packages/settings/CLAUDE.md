# CLAUDE.md — @cortex/settings

This file provides guidance for working with the settings package.

## Purpose

`@cortex/settings` manages persistent application settings with:
- In-memory cache for fast reads
- Zod schema validation
- JSON persistence to vault's `.cortex/app.json`
- Pub/sub notifications for settings changes

Appearance settings keep legacy `lineHeight` values parseable for older saved configs, but runtime typography height and weight belong to theme tokens. The appearance UI should expose font families and font sizes only.

## Key Export

```typescript
import { SettingsManager } from "@cortex/settings"

const settings = new SettingsManager()
await settings.loadFromVault("/path/to/vault")

// Read
const theme = settings.get("appearance", "theme")          // typed value
const section = settings.getSection("appearance")           // whole section
const all = settings.getAll()                               // AppSettings

// Write
settings.set("appearance", "theme", "dark")                // updates cache
await settings.flush()                                      // writes to disk

// Subscribe
const unsub = settings.subscribe(({ section, key, value }) => {
  console.log(`${section}.${key} changed to`, value)
})
unsub() // cleanup
```

## Testing

Tests live in `src/__tests__/`. Run with:

```bash
bun run --cwd packages/settings vitest run
# or from the monorepo root:
bun run test
```

### Mocking `@cortex/platform`

The SettingsManager uses `getPlatform().storage` for file I/O. Mock it in test files:

```typescript
const mockReadTextFile = vi.fn()
const mockWriteTextFile = vi.fn()

vi.mock("@cortex/platform", () => ({
  getPlatform: vi.fn(() => ({
    storage: {
      readTextFile: mockReadTextFile,
      writeTextFile: mockWriteTextFile,
      createDir: vi.fn().mockResolvedValue(undefined),
    },
  })),
}))
```

### Test Patterns

```typescript
// Test loadFromVault with existing settings
mockReadTextFile.mockResolvedValue(JSON.stringify({ appearance: { theme: "dark" } }))
await settings.loadFromVault("/vault")
expect(settings.get("appearance", "theme")).toBe("dark")

// Test loadFromVault with missing file
mockReadTextFile.mockRejectedValue(new Error("File not found"))
await settings.loadFromVault("/vault")
expect(settings.get("appearance", "theme")).toBe("light") // default

// Test subscriber notification
const listener = vi.fn()
settings.subscribe(listener)
settings.set("appearance", "theme", "dark")
expect(listener).toHaveBeenCalledWith({ section: "appearance", key: "theme", value: "dark" })
```

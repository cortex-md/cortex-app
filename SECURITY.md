# Security Policy

Cortex stores people's notes, so we treat security reports as a priority.

## Supported Versions

Cortex is pre-release. Only the latest published release and the `main` branch receive security
fixes.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| `main` | Yes |
| Older releases | No — please update first |

## Reporting A Vulnerability

**Do not open a public issue, discussion, or pull request for a vulnerability.**

Report it privately through
[GitHub Security Advisories](https://github.com/cortex-md/cortex-app/security/advisories/new).
Include:

- What is affected (desktop, mobile, web, sync engine, plugin host, CLI) and which version or commit.
- Steps to reproduce, a proof of concept, or the relevant code path.
- The impact you expect (data exposure, code execution, privilege escalation, sync key leak, ...).

We aim to acknowledge reports within 3 business days and to share a remediation plan within 14 days.
We will credit you in the advisory unless you ask us not to.

## Scope

In scope:

- The Electron desktop app, including the main process, preload bridge and IPC surface.
- Sync: end-to-end encryption, vault keys, invites, sharing, and the sync engine.
- The plugin and theme host: permission checks, sandboxing, and Marketplace install/update.
- The web app and account flows in `apps/web`.
- The mobile app and the `@cortex.md/api` package.

Out of scope:

- Third-party community plugins and themes. Report those to their authors, or to the
  [registry](https://github.com/cortex-md/registry/issues) if a listed extension is malicious.
- Issues that need a compromised device, a malicious plugin the user explicitly installed with the
  requested permissions, or physical access.
- Missing hardening headers or best practices without a demonstrated impact.

## Safe Harbor

We will not pursue action against good-faith research that respects user privacy, avoids data
destruction, and gives us reasonable time to fix the issue before disclosure.

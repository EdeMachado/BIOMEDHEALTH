# BioMed Health — Dependency Management

## 1. Scope

This document defines the dependency and lockfile policy for the BioMed Health npm workspace.

## 2. Canonical workspace

The repository root is the canonical npm workspace and declares:

```json
{
  "workspaces": ["apps/*"]
}
```

All dependency installation, updates, validation and CI execution must start from the repository root.

## 3. Single lockfile policy

`/package-lock.json` is the only authoritative lockfile.

Nested lockfiles such as `apps/web/package-lock.json` are prohibited because they can:

- resolve a dependency graph different from the workspace root;
- produce different local and CI installations;
- hide platform-specific optional dependency omissions;
- create ambiguity during dependency review and security auditing.

## 4. Approved commands

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

For dependency changes:

```bash
npm install <package> --workspace web
npm install -D <package> --workspace web
```

The resulting root `package-lock.json` must be committed with the related `package.json` change.

## 5. Node version

The project uses the Node version declared in `.nvmrc` and constrained by the root and workspace `engines` fields. CI reads `.nvmrc` directly.

## 6. Native optional dependencies

The current root lockfile was originally generated on Windows and omits native GNU/Linux optional packages used by Tailwind CSS during production builds.

Until the root lockfile is regenerated canonically on Linux, CI installs these exact compatibility binaries without persisting them:

- `lightningcss-linux-x64-gnu@1.30.1`
- `@tailwindcss/oxide-linux-x64-gnu@4.1.13`

This is a temporary, explicit and version-pinned compatibility control. It must not be silently removed or version-broadened.

## 7. Permanent remediation

The permanent remediation must be performed in an isolated PR:

1. use Node from `.nvmrc` on Linux;
2. remove all `node_modules` directories;
3. remove the root `package-lock.json` only in the remediation branch;
4. run `npm install` from the repository root;
5. verify that the regenerated lock includes the required Linux native optional packages;
6. run `npm ci`, typecheck, lint, all unit/integration tests and production build;
7. remove the temporary native-binary CI step;
8. confirm the full CI remains green.

No dependency versions should be intentionally upgraded in that remediation unless reviewed as a separate change.

## 8. Pull request requirements

A dependency-related PR must state:

- packages added, removed or updated;
- whether runtime or development only;
- lockfile impact;
- security or licensing considerations when applicable;
- CI results;
- rollback approach.

## 9. Prohibitions

Do not:

- run `npm install` from `apps/web` as an independent project;
- commit nested lockfiles;
- use floating native-binary versions in CI;
- bypass a failing build;
- use `npm audit fix --force` without an isolated review;
- mix dependency upgrades with unrelated functional work.

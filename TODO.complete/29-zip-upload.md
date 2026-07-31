# TODO 29 — ZIP package upload + extraction

**Priority:** P1   **Status:** ✅ done

## Goal

Make `loadPackage(path-to-.zip)` actually extract the ZIP and load the
package — the plug-and-play upload path. A user drops a `.sst.zip` file
on the shell, the runtime extracts it to a temp directory, validates
the manifest, and returns a `LoadedPackage` that `runSession()` can
boot. When the session ends, the temp directory is cleaned up.

## What landed

- `packages/runtime/sst-runtime/src/package-loader.ts`:
  - `extractZip(zipPath, destDir)` — yauzl-based extraction with path-
    traversal guard (`sanitizeEntryPath` rejects entries that escape
    the destination via `..` or absolute paths).
  - `loadPackage()` now accepts `.zip` paths in addition to directories.
    ZIPs are extracted to a unique temp directory under `os.tmpdir()`;
    the returned `LoadedPackage` carries a `cleanup()` that removes it.
  - Directory-loaded packages have no `cleanup` (they don't own the dir).

## What didn't land (TODO future)

- The shell-side `<input type="file">` upload UI — the runtime supports
  ZIPs but the shell still uses directory paths. TODO for the shell.
- A browser-side validation suite (sandboxing untrusted packages).

## Acceptance criteria

- ✅ `extractZip` extracts a real .zip to a destination directory.
- ✅ Path-traversal attempts are rejected.
- ✅ `loadPackage('foo.zip')` reads the manifest from the extracted
  directory and returns a LoadedPackage.
- ✅ `LoadedPackage.cleanup()` removes the temp directory.
- ✅ Directory-loaded packages have no `cleanup`.
- ✅ `runSession(loadPackage(zip))` boots end-to-end (the plug-and-play
  path) — verified in `run-session-boot.test.ts`.
- ✅ 7 tests in `tests/zip-upload.test.ts` + 1 cross-test; 100/100 runtime.

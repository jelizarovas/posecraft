# Studio on your device

Build the editor with `npm run build:studio` and host `dist/studio` over HTTPS. Localhost also supports installation and direct file access. A plain HTTP LAN address does not provide those browser capabilities; project import and download still work there.

Open project selects a local `.posecraft.json` file. In browsers with File System Access support, Save writes back to that file. More options contains Save project as and Reopen recent local project. Studio remembers the file handle in IndexedDB and checks permission when you explicitly reopen it. Nothing is uploaded. Reopening does not automatically replace a recovery draft at startup.

Studio saves recovery drafts separately in browser storage. Opening another project first preserves the previous document under Recover draft from before opening. This is a single recovery slot, not revision history. Export scene always downloads a copy. Other browsers use import and download for Open and Save as well.

Save compares the file contents against the last opened or saved version. If another app changed the file, Studio refuses to overwrite it and offers reopening or Save as through its message. Canceled pickers and denied access leave the draft intact. Edits made while a save is running remain marked as draft changes. Files are limited to 5 MB in Character Studio. Browser storage can be cleared, so keep project files outside the browser too.

The installed editor can start offline after its first successful cache installation. Its cache includes the editor, its scene library, simulation worker, local fonts and icons. It excludes the public map and native 3D asset directories. Draw and Director are separate pages and are not promised offline by this first Studio cache. Website export runtime downloads also require a network connection unless already available.

Updates wait until all open Studio tabs close. Studio never activates a waiting update by forcibly reloading your document. The install prompt appears in More options when the browser offers installation; the browser's own install menu also works.

Validation commands:

```sh
node --test test/project-files.test.js
node test/project-files-browser.mjs
npm run build:studio
node test/studio-pwa-browser.mjs
```

The browser file tests mock picker selection but use real browser file handles and IndexedDB. The PWA test serves the production build beneath a nested URL, disables the network, edits a project and verifies draft recovery after reload. Physical-device installation and native OS picker dialogs remain manual checks.

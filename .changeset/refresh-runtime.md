---
'@open-sheet/core': patch
---

Fix a blank viewer in every published install. `@vitejs/plugin-react` was a
devDependency, so it was bundled into `dist` and its Fast Refresh runtime
resolved to a file that does not exist there. It is a runtime dependency now.

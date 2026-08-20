---
'@open-sheet/core': patch
---

`<Sheet print={{ … }}>` sets orientation, paper size, fit-to-width, margins, and
whether the table header repeats on every printed page. Without it Excel prints
landscape at 100%, so a form comes out sideways and page two of a long table
arrives with no header — neither recoverable by the person holding the paper.
HTML and PDF follow the same declaration.

# Where style files live

A style file sits beside what it styles:

- used by one feature: in that feature's folder, for example `src/features/cellar/cellar.css`
- used by shared components only: in `src/components/`
- used by several features, or loaded for every page from `main.tsx` or `App.tsx`: here, in `src/styles/`

`styles.css` in this folder holds the colours, spacing and the basic building blocks (buttons, chips,
cards) that everything else builds on.

File names are unique across the app. Tests find a stylesheet by its file name through
`tests/unit/support/styleSheets.ts`, so moving one to a different folder needs no test changes.

Moving a file must not change the order in which styles load: keep each `import '….css'` line where
it is and change only its path. A quick proof is to build before and after and compare the files in
`dist/client/assets/*.css`; they should be identical.

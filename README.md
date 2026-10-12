# BPMN Modeler

A small TypeScript web app that uses [bpmn-js](https://bpmn.io/toolkit/bpmn-js/) to view and edit BPMN 2.0 diagrams. It runs locally with [Vite](https://vite.dev/).

## Run

```sh
npm install
npm run dev        # dev server at http://localhost:5173
```

## Other scripts

```sh
npm run typecheck  # TypeScript check only
npm run build      # type-check, then build to dist/
npm run preview    # serve the production build
```

## Open a generated diagram (e.g. from an AI agent)

```sh
npm run open -- path/to/process.bpmn
```

This copies the file to `public/diagrams/process.bpmn`, starts the dev server in the background if it isn't running, and opens `http://localhost:5173/?diagram=process`.

- If that page is already open, it reloads the diagram whenever the file is written again. Add `--no-open` to skip opening another tab.
- An agent can also skip the script: write the file to `public/diagrams/<name>.bpmn` itself, then open `/?diagram=<name>`.
- If the file has no diagram layout (no `BPMNShape`/`BPMNEdge` for some elements, which is common in generated BPMN), [bpmn-auto-layout](https://github.com/bpmn-io/bpmn-auto-layout) lays it out automatically. Missing `<incoming>`/`<outgoing>` references are filled in from the sequence flows first.
- Auto layout limits: only the first process of a collaboration is laid out, sub-processes come out collapsed, and text annotations, groups and message flows are dropped.

## Features

- Editing canvas with the palette, context pad, keyboard shortcuts and undo/redo
- **New**: start from a blank diagram
- **Open…**: load a `.bpmn` file (you can also drag and drop one onto the canvas)
- **Save .bpmn** / **Export SVG**: download the current diagram
- **Auto layout**: re-arrange the current diagram
- The sample diagram is in `src/diagrams/sample.bpmn`

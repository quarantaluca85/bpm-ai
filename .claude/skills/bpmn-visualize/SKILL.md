---
name: bpmn-visualize
description: Generate BPMN 2.0 process models and show them in this project's local bpmn-js modeler (Vite app on localhost:5173). Use this whenever the user wants to model, draw, diagram, map, sketch or visualize a business process or workflow, create or change a .bpmn file, or open, show, preview or render an existing BPMN diagram, even if they never say "BPMN" (for example "map out how expense claims get approved" or "show me our onboarding flow as a diagram").
---

# Visualize a BPMN model

This project is a bpmn-js modeler that opens BPMN files on request. The loop is: write the XML, validate it, open it in the modeler, then tell the user what they are looking at. The validator matters because bpmn-js fails quietly: a misspelled element or a dangling reference simply vanishes from the canvas, and the user sees an incomplete diagram with no error.

## Workflow

0. **First run only:** if `node_modules/` is missing, run `npm install`.
1. **Write** the model to `processes/<kebab-case-name>.bpmn`, unless the user gave a path. Keep the source file there because `public/diagrams/` is a disposable, gitignored copy that the open script overwrites.
2. **Validate:**
   ```sh
   node .claude/skills/bpmn-visualize/scripts/validate-bpmn.mjs processes/<name>.bpmn
   ```
   - `ERROR` lines mean content will be dropped or not drawn. Fix all of them and validate again.
   - `WARNING` lines usually mean a real modelling slip (a dead end, an unlabelled branch, something auto layout will drop). Fix them unless they are deliberate, and mention any you keep.
   - The `LAYOUT` line says whether the app draws your coordinates or lays the diagram out itself.
3. **Open:**
   ```sh
   npm run open -- processes/<name>.bpmn
   ```
   This copies the file to `public/diagrams/`, starts the dev server in the background if needed, opens the browser and prints the URL (`http://localhost:5173/?diagram=<name>`). When you revise a diagram the user already has open, add `--no-open`: the open page reloads the diagram by itself, so another tab is just clutter.
4. **Report** the URL, a two- or three-line walkthrough of the flow (main path, decisions, outcomes), and any warnings you chose to keep. Tell the user they can edit in the browser. **Save .bpmn** downloads a copy to their browser's download folder and does not change `processes/<name>.bpmn`. If they want their edits kept, ask for the downloaded file and copy it over the source.

## Writing BPMN that renders well

### Leave the layout out (usually)

The app runs bpmn-auto-layout when the diagram information (`<bpmndi:BPMNDiagram>`) is missing, and the result is clean and left to right. Working out coordinates by hand is slow and error-prone, so for a single process with tasks, events, gateways and sub-processes, **omit `<bpmndi:BPMNDiagram>` entirely**.

Auto layout cannot draw pools, lanes, message flows, text annotations or groups, and it shows sub-processes collapsed. If the user needs any of those to be visible, write the full layout yourself: read [references/manual-layout.md](references/manual-layout.md) first. If you are not sure the user needs swimlanes, ask; a flat process is often enough.

Avoid partial layout. If even one task, event, gateway or flow lacks a shape, the app re-lays out everything and discards all coordinates you wrote. When you edit a file that already has a layout, either add a shape or edge for every new element, or delete the whole `<bpmndi:BPMNDiagram>` and let the app re-lay it out.

### Skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  id="Definitions_ExpenseClaim"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_ExpenseClaim" name="Expense claim" isExecutable="false">
    <bpmn:startEvent id="Start_ClaimSubmitted" name="Claim submitted" />
    <bpmn:userTask id="Task_ReviewClaim" name="Review claim" />
    <bpmn:exclusiveGateway id="Gateway_Approved" name="Approved?" />
    <bpmn:serviceTask id="Task_PayOut" name="Pay out" />
    <bpmn:sendTask id="Task_NotifyRejection" name="Notify rejection" />
    <bpmn:endEvent id="End_Paid" name="Claim paid" />
    <bpmn:endEvent id="End_Rejected" name="Claim rejected" />

    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_ClaimSubmitted" targetRef="Task_ReviewClaim" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_ReviewClaim" targetRef="Gateway_Approved" />
    <bpmn:sequenceFlow id="Flow_Yes" name="yes" sourceRef="Gateway_Approved" targetRef="Task_PayOut" />
    <bpmn:sequenceFlow id="Flow_No" name="no" sourceRef="Gateway_Approved" targetRef="Task_NotifyRejection" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_PayOut" targetRef="End_Paid" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_NotifyRejection" targetRef="End_Rejected" />
  </bpmn:process>
</bpmn:definitions>
```

### Rules the validator enforces

- Element names are case-sensitive camelCase in the `bpmn:` namespace: `userTask`, `exclusiveGateway`, `sequenceFlow`. A typo such as `usertask` is silently dropped.
- Ids must be unique and valid XML names: start with a letter or `_`, no spaces. Prefixed, readable ids (`Task_ReviewClaim`) make validator output easy to act on.
- Every `sequenceFlow` needs a `sourceRef` and a `targetRef` that match existing ids. You do not need `<bpmn:incoming>`/`<bpmn:outgoing>` children; the app fills them in before laying out.

### Modelling conventions

- **Names:** tasks are verb + object ("Review claim"), events are states ("Claim submitted"), exclusive gateways are questions ("Approved?") with a name on every outgoing flow ("yes"/"no"). An unnamed branch forces the reader to guess.
- **Task types:** use the specific type when it is clear who or what does the work: `userTask` (a person in a system), `manualTask` (a person, no system), `serviceTask` (automated), `sendTask`/`receiveTask` (messages), `businessRuleTask`, `scriptTask`. Use a plain `task` when unsure.
- **Gateways:** a `parallelGateway` that splits needs a matching `parallelGateway` that joins. Merging alternative paths can go straight into the next task, or through an `exclusiveGateway` for clarity.
- **Ends:** give each distinct outcome its own end event ("Claim paid", "Claim rejected") rather than funnelling everything into one.
- **Size:** keep a diagram to about 20 nodes or fewer. For larger processes, move detail into a `subProcess` (auto layout shows it collapsed and the user can drill in) or split it into separate files.

## Troubleshooting

- **The toolbar status says "Diagram not found":** the name in the URL must match `public/diagrams/<name>.bpmn`. The open script turns characters other than letters, digits, `_`, `.` and `-` into `_`, so use the URL it prints.
- **"Dev server did not start":** another program is probably using port 5173. Tell the user rather than changing the port, because the URL convention depends on it.
- **The canvas is empty or incomplete but the status says "Opened":** run the validator; a missing layout for some elements is the usual cause.
- **Status text:** "(auto layout applied)" means the app generated the layout, and "N warning(s)" means bpmn-js reported import problems in the browser console.

## Checking the render yourself (optional)

When the user is not watching the browser, you can confirm what rendered with a headless browser. On Windows, Edge is always installed. Use a fresh profile folder and a `timeout` each time: headless Edge sometimes keeps running after writing its output, especially when a profile folder is reused.

```sh
timeout 60 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --disable-gpu \
  --user-data-dir="$(mktemp -d)" --virtual-time-budget=15000 \
  --dump-dom "http://localhost:5173/?diagram=<name>" > "$TMPDIR/render.html"
grep -o '<span id="status"[^<]*' "$TMPDIR/render.html"          # status line
grep -o 'data-element-id="[^"]*"' "$TMPDIR/render.html" | sort -u  # every drawn element id
```

Replace `--dump-dom ... > file` with `--window-size=1200,700 --screenshot="$TMPDIR/render.png"` to get an image you can look at. On macOS or Linux, use Chrome or Chromium with the same flags.

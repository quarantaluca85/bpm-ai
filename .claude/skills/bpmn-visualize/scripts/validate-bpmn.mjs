// Checks a BPMN 2.0 file before it is opened in the modeler.
//
//   node .claude/skills/bpmn-visualize/scripts/validate-bpmn.mjs <file.bpmn>
//
// Exit code 1 = errors: parts of the diagram would be silently dropped or not drawn.
// Exit code 0 = OK; warnings point at modelling issues, the LAYOUT line says what the app will do.

import { readFileSync } from 'node:fs';
import { BpmnModdle } from 'bpmn-moddle';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-bpmn.mjs <file.bpmn>');
  process.exit(2);
}

const errors = [];
const warnings = [];
const layout = [];

function finish() {
  console.log(`validate-bpmn: ${file}`);
  for (const e of errors) console.log(`  ERROR    ${e}`);
  for (const w of warnings) console.log(`  WARNING  ${w}`);
  for (const l of layout) console.log(`  LAYOUT   ${l}`);
  console.log(errors.length ? `FAILED (${errors.length} error(s))` : `OK (${warnings.length} warning(s))`);
  process.exit(errors.length ? 1 : 0);
}

let parsed;
try {
  parsed = await new BpmnModdle().fromXML(readFileSync(file, 'utf8'));
} catch (err) {
  errors.push(`Not readable as BPMN 2.0 XML: ${describe(err)}`);
  finish();
}

/** One line from a parser message: "unparsable content <x> detected (line 4: unknown type <bpmn:Usertask>)". */
function describe(problem) {
  const [first, ...rest] = problem.message.split('\n');
  const line = rest.find((l) => l.includes('line:'))?.trim().replace('line: ', 'line ');
  const nested = rest.find((l) => l.includes('nested error:'))?.replace(/.*nested error: /, '');
  const details = [line, nested].filter(Boolean).join(': ');
  return details ? `${first} (${details})` : first;
}

const { rootElement: defs, warnings: parseWarnings } = parsed;

// Parser warnings mean content is lost on import: unknown/misspelled elements,
// references to ids that don't exist, duplicate ids.
for (const w of parseWarnings) errors.push(describe(w));

const rootElements = defs.rootElements || [];
const processes = rootElements.filter((e) => e.$type === 'bpmn:Process');
const collaboration = rootElements.find((e) => e.$type === 'bpmn:Collaboration');
if (!processes.length) errors.push('No <bpmn:process> element found.');

const NOT_IN_SEQUENCE = new Set(['bpmn:DataObject', 'bpmn:DataObjectReference', 'bpmn:DataStoreReference']);
// Same rule as DRAWABLE in src/layout.ts: these decide whether the app auto-lays out.
const TRIGGERS_LAYOUT = /(Task|task|Event|Gateway|subProcess|callActivity|transaction|sequenceFlow)$/;
const localName = (el) => el.$type.replace('bpmn:', '').replace(/^./, (c) => c.toLowerCase());
const label = (el) => (el.name ? `${el.id} "${el.name}"` : el.id);

// Element ids that need a BPMNShape/BPMNEdge to be visible
const layoutIds = []; // direct process children that make the app auto-layout when missing
const otherIds = []; // everything else drawable: not auto-laid out, just invisible when missing
const subProcesses = [];

function checkScope(scope, nested) {
  const elements = scope.flowElements || [];
  const flows = elements.filter((e) => e.$type === 'bpmn:SequenceFlow');
  const nodes = elements.filter((e) => e.$type !== 'bpmn:SequenceFlow' && !NOT_IN_SEQUENCE.has(e.$type));

  for (const el of elements) {
    if (el.$type === 'bpmn:DataObject') continue; // never drawn itself, only its references
    (!nested && TRIGGERS_LAYOUT.test(localName(el)) ? layoutIds : otherIds).push(el.id);
  }

  const incoming = new Map();
  const outgoing = new Map();
  for (const flow of flows) {
    if (!flow.sourceRef || !flow.targetRef) {
      errors.push(`Sequence flow ${flow.id} needs both sourceRef and targetRef pointing at existing ids.`);
      continue;
    }
    outgoing.set(flow.sourceRef.id, [...(outgoing.get(flow.sourceRef.id) || []), flow]);
    incoming.set(flow.targetRef.id, [...(incoming.get(flow.targetRef.id) || []), flow]);
  }

  if (!nested && !nodes.some((n) => n.$type === 'bpmn:StartEvent')) {
    warnings.push(`Process ${scope.id} has no start event.`);
  }
  if (!nested && !nodes.some((n) => n.$type === 'bpmn:EndEvent')) {
    warnings.push(`Process ${scope.id} has no end event.`);
  }

  for (const node of nodes) {
    const isEventSubProcess = node.$type === 'bpmn:SubProcess' && node.triggeredByEvent;
    const exempt = node.isForCompensation || isEventSubProcess;
    const ins = incoming.get(node.id) || [];
    const outs = outgoing.get(node.id) || [];

    if (!ins.length && !exempt && !['bpmn:StartEvent', 'bpmn:BoundaryEvent'].includes(node.$type)) {
      warnings.push(`${label(node)} has no incoming sequence flow (unreachable).`);
    }
    if (!outs.length && !exempt && node.$type !== 'bpmn:EndEvent') {
      warnings.push(`${label(node)} has no outgoing sequence flow (dead end).`);
    }
    if (/Task$/.test(node.$type) && !node.name) {
      warnings.push(`Task ${node.id} has no name, so it shows as an empty box.`);
    }
    if (['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway'].includes(node.$type) && outs.length > 1) {
      const unnamed = outs.filter((f) => !f.name && f !== node.default);
      if (unnamed.length) {
        warnings.push(`Branches of gateway ${label(node)} have no name: ${unnamed.map((f) => f.id).join(', ')}.`);
      }
    }
    if (node.$type === 'bpmn:SubProcess') {
      subProcesses.push(node);
      checkScope(node, true);
    }
  }
}

for (const process of processes) {
  checkScope(process, false);
  for (const artifact of process.artifacts || []) otherIds.push(artifact.id);
  for (const laneSet of process.laneSets || []) for (const lane of laneSet.lanes || []) otherIds.push(lane.id);
}
const hasLanes = processes.some((p) => (p.laneSets || []).some((ls) => ls.lanes?.length));
if (collaboration) {
  for (const p of collaboration.participants || []) otherIds.push(p.id);
  for (const m of collaboration.messageFlows || []) otherIds.push(m.id);
}

// Layout (BPMNDI): same decision as needsLayout() in src/layout.ts
const drawn = new Set();
for (const diagram of defs.diagrams || []) {
  for (const di of diagram.plane?.planeElement || []) if (di.bpmnElement) drawn.add(di.bpmnElement.id);
}
const missingLayout = layoutIds.filter((id) => !drawn.has(id));
const missingOther = otherIds.filter((id) => !drawn.has(id));

if (!missingLayout.length) {
  layout.push('Complete: the app draws the diagram exactly as positioned.');
  if (missingOther.length) {
    warnings.push(
      `These elements have no BPMNShape/BPMNEdge and will not be drawn: ${missingOther.join(', ')}. ` +
        'Add layout for them, or remove the whole <bpmndi:BPMNDiagram> so the app auto-lays out.'
    );
  }
} else {
  layout.push(
    drawn.size
      ? `Incomplete (no BPMNShape/BPMNEdge for ${missingLayout.join(', ')}): the app re-lays out the WHOLE diagram and discards all existing positions.`
      : 'None: the app lays the diagram out automatically (left to right).'
  );
  if (collaboration?.participants?.length) {
    warnings.push('Auto layout does not draw pools: only the first pool\'s process is shown, without the pool. Provide BPMNDI to show pools.');
  }
  if (hasLanes) warnings.push('Auto layout does not draw lanes (they stay in the XML but are invisible). Provide BPMNDI to show them.');
  if (collaboration?.messageFlows?.length) warnings.push('Auto layout drops message flows; provide BPMNDI to keep them.');
  const artifacts = processes.flatMap((p) => p.artifacts || []);
  if (artifacts.length) {
    warnings.push(`Auto layout drops text annotations, associations and groups (${artifacts.map((a) => a.id).join(', ')}).`);
  }
  if (subProcesses.length) {
    layout.push(`Sub-processes are shown collapsed (${subProcesses.map(label).join(', ')}); users drill in to see their content.`);
  }
}

finish();

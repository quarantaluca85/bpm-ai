import { layoutProcess } from 'bpmn-auto-layout';

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';

// Process children that bpmn-js draws on the canvas (flow nodes and sequence flows).
const DRAWABLE = /(Task|task|Event|Gateway|subProcess|callActivity|transaction|sequenceFlow)$/;

/**
 * True if any flow node or sequence flow has no diagram information
 * (BPMNShape / BPMNEdge). Such elements are invisible in bpmn-js.
 * AI-generated BPMN often leaves this section out entirely.
 */
export function needsLayout(xml: string): boolean {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return false; // let importXML report it

  const drawn = new Set<string>();
  for (const tag of ['BPMNShape', 'BPMNEdge']) {
    for (const el of doc.getElementsByTagNameNS(BPMNDI_NS, tag)) {
      const ref = el.getAttribute('bpmnElement');
      if (ref) drawn.add(ref);
    }
  }

  for (const process of doc.getElementsByTagNameNS(BPMN_NS, 'process')) {
    for (const child of process.children) {
      const id = child.getAttribute('id');
      if (id && DRAWABLE.test(child.localName) && !drawn.has(id)) return true;
    }
  }
  return false;
}

/** Replaces the diagram information with a generated left-to-right layout. */
export function autoLayout(xml: string): Promise<string> {
  return layoutProcess(addFlowRefs(xml));
}

// Children that must come before <incoming>/<outgoing> in a flow node.
const LEADING = new Set(['documentation', 'extensionElements', 'incoming', 'outgoing']);

/**
 * bpmn-auto-layout follows each node's <incoming>/<outgoing> children, which
 * generated BPMN often omits (only sequenceFlow sourceRef/targetRef are set).
 * Adds the missing ones so the layouter sees the connections.
 */
function addFlowRefs(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return xml;

  const byId = new Map<string, Element>();
  for (const el of doc.getElementsByTagNameNS(BPMN_NS, '*')) {
    const id = el.getAttribute('id');
    if (id) byId.set(id, el);
  }

  let changed = false;
  const ensureRef = (node: Element | undefined, kind: 'incoming' | 'outgoing', flowId: string) => {
    if (!node) return;
    const existing = [...node.children].some(
      (c) => c.namespaceURI === BPMN_NS && c.localName === kind && c.textContent?.trim() === flowId
    );
    if (existing) return;

    const ref = doc.createElementNS(BPMN_NS, node.prefix ? `${node.prefix}:${kind}` : kind);
    ref.textContent = flowId;
    // Keep schema order: incoming refs before outgoing, both before e.g. event definitions
    const before = [...node.children].find(
      (c) => !LEADING.has(c.localName) || (kind === 'incoming' && c.localName === 'outgoing')
    );
    node.insertBefore(ref, before ?? null);
    changed = true;
  };

  for (const flow of doc.getElementsByTagNameNS(BPMN_NS, 'sequenceFlow')) {
    const id = flow.getAttribute('id');
    if (!id) continue;
    ensureRef(byId.get(flow.getAttribute('sourceRef') ?? ''), 'outgoing', id);
    ensureRef(byId.get(flow.getAttribute('targetRef') ?? ''), 'incoming', id);
  }

  return changed ? new XMLSerializer().serializeToString(doc) : xml;
}

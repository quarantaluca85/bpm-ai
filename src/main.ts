import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './style.css';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import type Canvas from 'diagram-js/lib/core/Canvas';

import { autoLayout, needsLayout } from './layout';
import sampleXml from './diagrams/sample.bpmn?raw';
import blankXml from './diagrams/blank.bpmn?raw';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const canvasEl = byId<HTMLElement>('canvas');
const statusEl = byId<HTMLSpanElement>('status');
const fileInput = byId<HTMLInputElement>('file-input');

const modeler = new BpmnModeler({
  container: canvasEl,
  keyboard: { bindTo: document }
});

let currentName = 'diagram';

// Name from ?diagram=<name>, served from public/diagrams/<name>.bpmn
const urlDiagram = new URLSearchParams(location.search).get('diagram');

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/** Fits the diagram with some margin, keeping the left edge clear of the palette. */
function zoomToFit(): void {
  const canvas = modeler.get<Canvas>('canvas');
  canvas.zoom('fit-viewport');
  const { x, y, width, height } = canvas.viewbox();
  canvas.viewbox({ x: x - width * 0.15, y: y - height * 0.1, width: width * 1.2, height: height * 1.2 });
}

/**
 * Imports the XML into the modeler. With layout 'auto' the diagram is laid out
 * only when elements lack diagram information; 'force' always lays it out.
 */
async function openDiagram(
  xml: string,
  name: string,
  layout: 'auto' | 'force' = 'auto'
): Promise<void> {
  let laidOut = false;
  if (layout === 'force' || needsLayout(xml)) {
    try {
      xml = await autoLayout(xml);
      laidOut = true;
    } catch (err) {
      console.warn('Auto layout failed, importing as-is', err);
    }
  }

  try {
    const { warnings } = await modeler.importXML(xml);
    currentName = name;
    zoomToFit();
    const suffix = laidOut ? ' (auto layout applied)' : '';
    if (warnings.length) {
      console.warn('BPMN import warnings', warnings);
      setStatus(`Opened ${name}${suffix} with ${warnings.length} warning(s), see console`);
    } else {
      setStatus(`Opened ${name}${suffix}`);
    }
  } catch (err) {
    console.error('BPMN import failed', err);
    setStatus(`Could not open ${name}: ${(err as Error).message}`, true);
  }
}

async function openFile(file: File): Promise<void> {
  const name = file.name.replace(/\.(bpmn|xml)$/i, '');
  await openDiagram(await file.text(), name);
}

async function openFromServer(name: string): Promise<void> {
  if (!/^[\w.-]+$/.test(name)) {
    setStatus(`Invalid diagram name "${name}"`, true);
    return;
  }
  const path = `/diagrams/${name}.bpmn`;
  try {
    const res = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/xml' } });
    const text = await res.text();
    // The dev server answers unknown paths with index.html, so check the content too
    if (!res.ok || /^\s*<!doctype html/i.test(text)) {
      setStatus(`Diagram not found: ${path}`, true);
      return;
    }
    await openDiagram(text, name);
  } catch (err) {
    setStatus(`Could not load ${path}: ${(err as Error).message}`, true);
  }
}

function download(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Toolbar
byId('btn-new').addEventListener('click', () => openDiagram(blankXml, 'diagram'));
byId('btn-open').addEventListener('click', () => fileInput.click());
byId('btn-fit').addEventListener('click', zoomToFit);

byId('btn-layout').addEventListener('click', async () => {
  const { xml } = await modeler.saveXML();
  if (xml) await openDiagram(xml, currentName, 'force');
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) await openFile(file);
  fileInput.value = '';
});

byId('btn-save').addEventListener('click', async () => {
  try {
    const { xml } = await modeler.saveXML({ format: true });
    if (xml) download(xml, `${currentName}.bpmn`, 'application/xml');
  } catch (err) {
    setStatus(`Save failed: ${(err as Error).message}`, true);
  }
});

byId('btn-svg').addEventListener('click', async () => {
  try {
    const { svg } = await modeler.saveSVG();
    download(svg, `${currentName}.svg`, 'image/svg+xml');
  } catch (err) {
    setStatus(`SVG export failed: ${(err as Error).message}`, true);
  }
});

// Drag and drop a .bpmn file onto the canvas
canvasEl.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) {
    e.preventDefault();
    canvasEl.classList.add('drag-over');
  }
});
canvasEl.addEventListener('dragleave', () => canvasEl.classList.remove('drag-over'));
canvasEl.addEventListener('drop', async (e) => {
  canvasEl.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) {
    e.preventDefault();
    await openFile(file);
  }
});

// Dev server only: reload when the agent rewrites public/diagrams/<name>.bpmn (see vite.config.ts)
import.meta.hot?.on('bpmn:changed', ({ name }: { name: string }) => {
  if (name === urlDiagram) void openFromServer(name);
});

void (urlDiagram ? openFromServer(urlDiagram) : openDiagram(sampleXml, 'sample'));

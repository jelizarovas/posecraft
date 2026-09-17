import { assertDocument } from './schema.js';

// Paths are arrays so an ID never becomes executable syntax. Validation is atomic.
export class DocumentStore {
  constructor(document) { this.document = structuredClone(assertDocument(document)); this.past = []; this.future = []; }
  transact(commands, expectedRevision = this.document.revision) {
    if (expectedRevision !== this.document.revision) throw new Error(`Revision conflict: expected ${expectedRevision}, current ${this.document.revision}.`);
    if (!Array.isArray(commands) || !commands.length || commands.length > 100) throw new Error('Supply 1..100 commands.');
    const next = structuredClone(this.document);
    for (const command of commands) {
      if (command.op !== 'set' || !Array.isArray(command.path) || !command.path.length || ['revision', 'schemaVersion'].includes(command.path[0])) throw new Error('Expected set command with an editable path.');
      let target = next;
      for (const key of command.path) if (['__proto__', 'prototype', 'constructor'].includes(String(key))) throw new Error('Reserved path.');
      for (const key of command.path.slice(0, -1)) { if (!target || !Object.hasOwn(target, key)) throw new Error(`Missing path: ${command.path.join('.')}`); target = target[key]; }
      const key = command.path.at(-1);
      if (!target || typeof target !== 'object') throw new Error('Path does not address an object.');
      target[key] = structuredClone(command.value);
    }
    next.revision++;
    assertDocument(next);
    this.past.push(this.document); if (this.past.length > 60) this.past.shift();
    this.future = []; this.document = next;
    return structuredClone(next);
  }
  undo() { return this.restore(this.past, this.future); }
  redo() { return this.restore(this.future, this.past); }
  restore(from, to) {
    if (!from.length) return structuredClone(this.document);
    const previous = structuredClone(from.pop()); previous.revision = this.document.revision + 1;
    to.push(this.document); this.document = previous; return structuredClone(previous);
  }
}

// @ton/core relies on Node's Buffer. Must be imported before anything that touches @ton/core.
import { Buffer } from 'buffer';

if (!('Buffer' in globalThis)) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

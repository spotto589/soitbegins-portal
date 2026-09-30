import { legalResponse } from './_legal.js';

// See _legal.js.
export function onRequestGet() {
  return legalResponse('terms');
}

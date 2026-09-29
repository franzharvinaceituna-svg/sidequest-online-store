// Small helpers shared by the ported components.
// L: always iterate an array. S: text for string interpolation. T: safe text child.
import React from 'react';
export const L = x => (Array.isArray(x) ? x : []);
export const S = x => (x === undefined || x === null ? '' : String(x));
export const T = x => {
  if (x === undefined || x === null || typeof x === 'boolean') return null;
  if (React.isValidElement(x) || Array.isArray(x)) return x;
  return String(x);
};

/**
 * design-sync only — never imported by site code.
 *
 * @fable/sections is "type": "module", so when esbuild bundles it for the
 * design-sync IIFE, `import Image from "next/image"` gets Node-style CJS
 * interop: the raw exports object ({ __esModule, default, getImageProps })
 * instead of the component. The bundle's tsconfig
 * (.design-sync/tsconfig.bundle.json) remaps "next/image" here, which
 * unwraps whichever shape arrives. Imports the deep module next/image.js
 * itself requires, so the remap can't recurse.
 */
import * as external from "next/dist/shared/lib/image-external.js";

type AnyRec = Record<string, unknown>;
const cjs = ((external as AnyRec).default ?? external) as AnyRec;
const unwrapped = (cjs.__esModule && cjs.default ? cjs.default : cjs) as unknown;

export default unwrapped as (typeof import("next/image"))["default"];
export const getImageProps = ((external as AnyRec).getImageProps ??
  cjs.getImageProps) as (typeof import("next/image"))["getImageProps"];

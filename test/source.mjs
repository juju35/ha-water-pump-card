// The card source the tests evaluate: src/ assembled into one classic script as scripts/build.mjs does
// (scripts/bundle.mjs), placeholders (__VERSION__ and the like) left as they are.
import { readFileSync } from "node:fs";
import { bundle } from "../scripts/bundle.mjs";

export const sharedSource = bundle("src/shared/index.js");
export const waterPumpCardSource = bundle("src/water-pump-card/index.js");
// by former file name, for loaders that took one
export const sources = { "shared.js": sharedSource, "water-pump-card.js": waterPumpCardSource };
// a file of src/ by its former URL or path: the bundle for a split file, the file itself otherwise
export const readSrc = (file) => sources[String(file).split("/").pop()] ?? readFileSync(file, "utf8");

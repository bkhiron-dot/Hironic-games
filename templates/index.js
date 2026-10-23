// Every Game Maker template. To add one: write templates/<name>.js and list it here.
import { CATCHER } from "./catcher.js";
import { DODGER } from "./dodger.js";

export const TEMPLATES = [CATCHER, DODGER];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id);

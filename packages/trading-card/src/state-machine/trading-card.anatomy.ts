import { createAnatomy } from "@zag-js/anatomy";

export const anatomy = createAnatomy("trading-card").parts(
  "root",
  "shadow",
  "inner",
  "front",
  "back",
  "content",
  "media",
  "label",
  "layer",
  "beam",
  "revealStage",
  "flipTrigger",
);

export const parts = anatomy.build();

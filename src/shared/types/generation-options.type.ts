import type { PieceType } from "./piece.type.js";

export type GenerateOptions = {
  name: string;
  type: PieceType;
  feature?: string | undefined;
  event?: string | undefined;
};

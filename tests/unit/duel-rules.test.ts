import type { RpsChoice } from "@shared/types/rps-choice.type.js";

import { RPS_CHOICES, resolveRps } from "@features/duel/duel.service.js";

import { describe, expect, it } from "vitest";

describe("resolveRps", () => {
  it.each(RPS_CHOICES)("calls %s against itself a draw", (choice) => {
    expect(resolveRps(choice, choice)).toBe("draw");
  });

  it.each([
    ["rock", "scissors"],
    ["paper", "rock"],
    ["scissors", "paper"],
  ] as [RpsChoice, RpsChoice][])("has %s beat %s", (winner, loser) => {
    expect(resolveRps(winner, loser)).toBe("challenger");
  });

  it("is symmetric: swapping the arguments swaps the winner", () => {
    for (const challenger of RPS_CHOICES) {
      for (const target of RPS_CHOICES) {
        const forward = resolveRps(challenger, target);
        const reversed = resolveRps(target, challenger);

        if (forward === "draw") {
          expect(reversed).toBe("draw");
        } else {
          expect(reversed).toBe(forward === "challenger" ? "target" : "challenger");
        }
      }
    }
  });

  it("has no unbeatable choice", () => {
    for (const choice of RPS_CHOICES) {
      const beatenBy = RPS_CHOICES.filter((other) => resolveRps(other, choice) === "challenger");
      expect(beatenBy).toHaveLength(1);
    }
  });
});

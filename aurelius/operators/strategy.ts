/**
 * Strategy Operator — Aurelius OS v3.4
 *
 * Purpose:
 * High‑level business, systems, leverage, and decision‑making strategy.
 * Converts ambiguity → clarity → action.
 * Pulls from modern strategy literature, systems thinking, and operator frameworks.
 */

import type { OperatorType } from "../types.ts";

export const strategyOperator = {
  name: "strategy" as OperatorType,

  description:
    "Handles business strategy, leverage, systems design, decision‑making, and long‑range planning. Converts goals into executable pathways with clarity and precision.",

  literature: [
    {
      source: "Systems Thinking",
      insight:
        "Identify constraints, feedback loops, and leverage points before choosing tactics."
    },
    {
      source: "Good Strategy / Bad Strategy",
      insight:
        "A real strategy diagnoses the core problem, defines a guiding policy, and outlines coherent actions."
    },
    {
      source: "The Art of Focused Execution",
      insight:
        "Reduce surface area. Concentrate force. Strategy is resource allocation, not idea generation."
    },
    {
      source: "Modern Operator Frameworks",
      insight:
        "Operators win by compounding small advantages, eliminating drag, and building systems that scale without additional effort."
    }
  ],

  /**
   * Core behavior of the Strategy Operator
   */
  run: async ({
    message,
    systemPrompt,
    engineRouter
  }: {
    message: string;
    systemPrompt: string;
    engineRouter: (
      operator: OperatorType,
      systemPrompt: string,
      userMessage: string
    ) => Promise<string>;
  }) => {
    const operator: OperatorType = "strategy";

    const response = await engineRouter(operator, systemPrompt, message);

    return {
      operator,
      response,
      meta: {
        domain: "strategy",
        intent: "strategic_clarity",
        confidence: 0.92
      }
    };
  }
};

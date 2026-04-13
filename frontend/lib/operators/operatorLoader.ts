// ================================
// AURELIUS OS 3.4 — OPERATOR LOADER
// Dynamically resolves operator definitions from the registry.
// ================================

import { operatorRegistry, OperatorDefinition } from "./operatorRegistry";

export function loadOperator(key: string): OperatorDefinition | null {
  if (operatorRegistry[key]) {
    return operatorRegistry[key];
  }

  console.warn(`Aurelius OperatorLoader: Unknown operator "${key}"`);
  return null;
}

export function listOperators(): OperatorDefinition[] {
  return Object.values(operatorRegistry);
}

import { operatorCores } from "../operators/operatorCores.ts";
import { getOperatorProfile, type OperatorProfile } from "./operatorProfiles.ts";

const VALID_OPERATOR_NAMES = new Set<string>(operatorCores.map((c) => c.name));

const DEFAULT_OPERATOR = "strategy";

export function isValidOperator(name: string): boolean {
  return VALID_OPERATOR_NAMES.has(name);
}

export function resolveOperatorName(name: string | undefined | null): string {
  if (!name) return DEFAULT_OPERATOR;
  if (VALID_OPERATOR_NAMES.has(name)) return name;
  return DEFAULT_OPERATOR;
}

export function getOperator(name: string): OperatorProfile {
  const resolved = resolveOperatorName(name);
  return getOperatorProfile(resolved);
}

export function listOperators(): string[] {
  return Array.from(VALID_OPERATOR_NAMES);
}

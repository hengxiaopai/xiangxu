export type CanonicalValidatedRequest = string & { readonly __canonicalValidatedRequest: true };

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}

export function canonicalizeValidatedRequest(validatedValue: unknown): CanonicalValidatedRequest {
  return JSON.stringify(normalize(validatedValue)) as CanonicalValidatedRequest;
}

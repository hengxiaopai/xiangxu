export type FakeJobResult = Readonly<{
  smokeId: string;
  status: "completed";
}>;

export function runFakeJob(smokeId: string): FakeJobResult {
  if (smokeId.length === 0) throw new Error("smokeId must not be empty");
  return Object.freeze({ smokeId, status: "completed" });
}

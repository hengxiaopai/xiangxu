const EXPECTED = Object.freeze({
  databaseHost: "127.0.0.1",
  databaseName: "xiangxu_stage5",
  databasePort: "55432",
  redisHost: "127.0.0.1",
  redisPort: "6379",
});

function required(environment, name) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required for Stage 5 local infrastructure`);
  return value;
}

function parseUrl(value, name, protocols) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}`);
  }
  return parsed;
}

export function readInfrastructureConfig(environment) {
  const databaseUrl = required(environment, "DATABASE_URL");
  const redisUrl = required(environment, "REDIS_URL");
  parseUrl(databaseUrl, "DATABASE_URL", ["postgres:", "postgresql:"]);
  parseUrl(redisUrl, "REDIS_URL", ["redis:"]);
  return Object.freeze({ databaseUrl, redisUrl });
}

export function assertStage5LocalConfig(config) {
  const database = parseUrl(config.databaseUrl, "DATABASE_URL", ["postgres:", "postgresql:"]);
  const redis = parseUrl(config.redisUrl, "REDIS_URL", ["redis:"]);
  const databasePort = database.port || "5432";
  const redisPort = redis.port || "6379";
  const databaseName = database.pathname.replace(/^\//, "");

  if (
    database.hostname !== EXPECTED.databaseHost ||
    databasePort !== EXPECTED.databasePort ||
    databaseName !== EXPECTED.databaseName ||
    redis.hostname !== EXPECTED.redisHost ||
    redisPort !== EXPECTED.redisPort
  ) {
    throw new Error("Refusing operation outside the fixed XIANGXU Stage 5 local infrastructure identity");
  }
}

export { EXPECTED as stage5ExpectedConfig };

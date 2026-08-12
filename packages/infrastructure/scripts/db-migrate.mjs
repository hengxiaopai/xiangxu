import { readInfrastructureConfig } from "./config.mjs";
import { migrateDatabase } from "./database.mjs";

const { databaseUrl } = readInfrastructureConfig(process.env);
await migrateDatabase(databaseUrl);
console.log("Database migration PASS.");

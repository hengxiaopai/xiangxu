import { readInfrastructureConfig } from "./config.mjs";
import { smokeDatabase } from "./database.mjs";

const { databaseUrl } = readInfrastructureConfig(process.env);
console.log(JSON.stringify(await smokeDatabase(databaseUrl)));

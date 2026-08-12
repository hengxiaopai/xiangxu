import { readInfrastructureConfig } from "./config.mjs";
import { smokeQueue } from "./queue.mjs";

const { redisUrl } = readInfrastructureConfig(process.env);
console.log(JSON.stringify(await smokeQueue(redisUrl)));

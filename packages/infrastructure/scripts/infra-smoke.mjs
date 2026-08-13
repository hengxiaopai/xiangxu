import { migrateDatabase, smokeDatabase, waitForStableDatabase } from "./database.mjs";
import { smokeQueue } from "./queue.mjs";
import { runDatabaseIntegrationTests } from "./integration.mjs";
import { runStage3HttpIntegration } from "./http-integration.mjs";
import {
  collectContainerEvidence,
  composeDownWithVolumes,
  composeUp,
  createRunContext,
  removeRunContext,
  requireDestructiveConfirmation,
} from "./runtime.mjs";

requireDestructiveConfirmation(process.argv.slice(2));
const context = await createRunContext();
try {
  composeDownWithVolumes(context);
  composeUp(context);
  const containers = collectContainerEvidence(context);
  await waitForStableDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);
  runDatabaseIntegrationTests(context.databaseUrl, context.redisUrl);
  await runStage3HttpIntegration(context.databaseUrl);
  const database = await smokeDatabase(context.databaseUrl);
  const queue = await smokeQueue(context.redisUrl);
  console.log(JSON.stringify({ containers, database, queue }));
} finally {
  try {
    composeDownWithVolumes(context);
  } finally {
    await removeRunContext(context);
  }
}

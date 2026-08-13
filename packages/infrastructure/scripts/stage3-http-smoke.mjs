import { migrateDatabase, waitForStableDatabase } from "./database.mjs";
import { runStage3HttpIntegration } from "./http-integration.mjs";
import {
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
  composeUp(context, ["postgres"]);
  await waitForStableDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);
  await migrateDatabase(context.databaseUrl);
  await runStage3HttpIntegration(context.databaseUrl);
} finally {
  try {
    composeDownWithVolumes(context);
  } finally {
    await removeRunContext(context);
  }
}

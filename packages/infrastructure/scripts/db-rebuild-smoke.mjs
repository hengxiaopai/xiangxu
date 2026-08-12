import { migrateDatabase, smokeDatabase, waitForStableDatabase } from "./database.mjs";
import {
  composeDownWithVolumes,
  composeUp,
  createRunContext,
  removeRunContext,
  requireDestructiveConfirmation,
} from "./runtime.mjs";

requireDestructiveConfirmation(process.argv.slice(2));
const context = await createRunContext();
const cycles = [];
try {
  composeDownWithVolumes(context);
  for (const cycle of [1, 2]) {
    composeUp(context, ["postgres"]);
    await waitForStableDatabase(context.databaseUrl);
    await migrateDatabase(context.databaseUrl);
    cycles.push({ cycle, ...(await smokeDatabase(context.databaseUrl)) });
    composeDownWithVolumes(context);
  }
  console.log(JSON.stringify({ cycles, result: "DB rebuild smoke PASS" }));
} finally {
  try {
    composeDownWithVolumes(context);
  } finally {
    await removeRunContext(context);
  }
}

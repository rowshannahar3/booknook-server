import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";

const config = loadConfig();
await connectDb(config);
createApp(config).listen(config.port, () => console.log(`BookNook API listening on port ${config.port}`));

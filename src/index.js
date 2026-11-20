import dns from "node:dns";
import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";

// Some networks refuse the SRV lookup that mongodb+srv:// needs.
// Optionally override Node's DNS servers, for example DNS_SERVERS=8.8.8.8,1.1.1.1
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

const config = loadConfig();
await connectDb(config);
createApp(config).listen(config.port, () => console.log(`BookNook API listening on port ${config.port}`));
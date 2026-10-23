// Searches for every /systems circle that data/system-layouts.json does not already hold for the model on disk,
// and saves them (scripts/lib/system-insides-plugin.mjs). The model's daily refresh runs it before it commits.
import { drawInsides } from "./lib/system-insides-plugin.mjs";

drawInsides({ write: true });

import "dotenv/config";
import { connectDatabase } from "./src/config/database.js";
import app from "./src/app.js";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
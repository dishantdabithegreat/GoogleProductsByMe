
import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

let server;
let isShuttingDown = false;

// Start Goku backend
async function startServer() {
  try {
    // Connect to MongoDB before accepting requests
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`Goku backend running on port ${PORT}`);
    });

    server.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("Goku startup failed:", error.message);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down Goku...`);

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    console.log("HTTP server closed.");

    try {
      const mongoose = await import("mongoose");
      await mongoose.default.connection.close();

      console.log("MongoDB connection closed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Start application
startServer();

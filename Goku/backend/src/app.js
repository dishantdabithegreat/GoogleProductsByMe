import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import authRoutes from "./routes/authRoutes.js";
import savedPlaceRoutes from "./routes/savedPlaceRoutes.js";

const app = express();

// Security headers
app.use(helmet());
// Frontend access
app.use(
    cors({
        origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
        credentials: true,
    })
);

// Parse JSON requests
app.use(express.json({ limit: "10kb" }));

// HTTP request logging
app.use(pinoHttp());

// API rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

app.use("/api", apiLimiter);

// Authentication Routes
app.use("/api/v1/auth", authRoutes);

// Saved Places Routes
app.use("/api/v1/saved-places", savedPlaceRoutes);

// Health check
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Goku API is running",
    service: "goku-backend",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Central error handler
app.use((err, req, res, next) => {
  req.log?.error(err);

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Something went wrong",
  });
});

export default app;

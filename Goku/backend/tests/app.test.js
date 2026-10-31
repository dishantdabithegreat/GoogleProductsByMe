
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Goku API", () => {
  it("should return a successful health check", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.service).toBe("goku-backend");
  });

  it("should return 404 for an unknown route", async () => {
    const response = await request(app).get("/api/v1/unknown");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

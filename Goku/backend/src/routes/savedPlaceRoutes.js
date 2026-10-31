
import express from "express";
import mongoose from "mongoose";

import SavedPlace from "../models/SavedPlace.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All saved-place routes require authentication.
router.use(protect);

// GET: Fetch the logged-in user's saved places.
router.get("/", async (req, res, next) => {
  try {
    const places = await SavedPlace.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: places.length,
      places,
    });
  } catch (error) {
    next(error);
  }
});

// POST: Save a new place.
router.post("/", async (req, res, next) => {
  try {
    const {
      placeId,
      name,
      address,
      latitude,
      longitude,
      category,
      website,
      phone,
    } = req.body;

    if (
      typeof placeId !== "string" ||
      !placeId.trim() ||
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid place ID, name, latitude and longitude are required.",
      });
    }

    const place = await SavedPlace.create({
      user: req.user._id,
      placeId: placeId.trim(),
      name: name.trim(),
      address,
      latitude,
      longitude,
      category,
      website,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Place saved successfully",
      place,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already saved this place.",
      });
    }

    next(error);
  }
});

// DELETE: Remove a saved place.
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid saved place ID.",
      });
    }

    const place = await SavedPlace.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!place) {
      return res.status(404).json({
        success: false,
        message: "Saved place not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Place removed from saved places.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

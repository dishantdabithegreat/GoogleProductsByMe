
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    placeName: {
      type: String,
      required: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user for each place.
reviewSchema.index(
  { placeId: 1, userId: 1 },
  { unique: true }
);

const Review = mongoose.model("Review", reviewSchema);

export default Review;

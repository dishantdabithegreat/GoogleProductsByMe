import mongoose from "mongoose";

const savedPlaceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    placeId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      default: "",
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const SavedPlace = mongoose.model("SavedPlace", savedPlaceSchema);

export default SavedPlace;
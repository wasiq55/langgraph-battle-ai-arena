
import mongoose, { Schema } from "mongoose";

const attachmentSchema = new Schema(
  {
    fileId: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      default: "application/octet-stream"
    },
    size: {
      type: Number,
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const turnSchema = new Schema(
  {
    question: {
      type: String,
      required: true
    },
    solution_1: {
      type: String,
      default: ""
    },
    solution_2: {
      type: String,
      default: ""
    },
    judge: {
      type: Schema.Types.Mixed,
      default: null
    },
    attachments: {
      type: [Schema.Types.Mixed],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const conversationSchema = new Schema(
  {
    conversationId: {
      type: String,
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      default: "New chat",
      trim: true,
      maxlength: 200
    },
    turns: {
      type: [turnSchema],
      default: []
    }
  },
  { timestamps: true }
);

conversationSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true }
);

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;

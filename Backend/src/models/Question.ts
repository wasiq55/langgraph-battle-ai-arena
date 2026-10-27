
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

const questionSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    userEmail: {
      type: String,
      default: ""
    },
    chatId: {
      type: String,
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      maxlength: 60000
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    solution1: {
      type: Schema.Types.Mixed,
      default: null
    },
    solution2: {
      type: Schema.Types.Mixed,
      default: null
    },
    judge: {
      type: Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending"
    },
    errorMessage: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

questionSchema.index({ createdAt: -1 });
questionSchema.index({ userId: 1, chatId: 1 });

const Question =
  mongoose.models.Question ||
  mongoose.model("Question", questionSchema);

export default Question;

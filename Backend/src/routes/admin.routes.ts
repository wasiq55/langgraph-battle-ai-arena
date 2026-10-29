
import { Router } from "express";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Question from "../models/Question.js";
import Message from "../models/Message.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

function getDatabase() {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB database connection is not ready");
  }

  return db;
}

function getUploadBucket() {
  return new GridFSBucket(getDatabase(), {
    bucketName: "uploads"
  });
}

function getGeneratedImageBucket() {
  return new GridFSBucket(getDatabase(), {
    bucketName: "generatedImages"
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPagination(req: {
  query: Record<string, unknown>;
}) {
  const pageValue = Number(req.query.page);
  const limitValue = Number(req.query.limit);

  const page =
    Number.isFinite(pageValue) && pageValue > 0
      ? Math.floor(pageValue)
      : 1;

  const limit =
    Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(50, Math.floor(limitValue))
      : 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

router.get("/stats", async (_req, res) => {
  try {
    const db = getDatabase();

    const [
      totalUsers,
      totalConversations,
      totalQuestions,
      pendingQuestions,
      completedQuestions,
      failedQuestions,
      uploadedFiles,
      generatedImages,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      Conversation.countDocuments(),
      Question.countDocuments(),
      Question.countDocuments({ status: "pending" }),
      Question.countDocuments({ status: "completed" }),
      Question.countDocuments({ status: "failed" }),
      db.collection("uploads.files").countDocuments(),
      db.collection("generatedImages.files").countDocuments(),
      User.find()
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalConversations,
        totalQuestions,
        pendingQuestions,
        completedQuestions,
        failedQuestions,
        totalFiles: uploadedFiles + generatedImages,
        uploadedFiles,
        generatedImages,
        recentUsers
      }
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load admin statistics"
    });
  }
});

router.get("/files", async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const filter: Record<string, unknown> = {};

    if (search) {
      const escaped = escapeRegex(search);

      filter.$or = [
        { filename: { $regex: escaped, $options: "i" } },
        { "metadata.originalName": { $regex: escaped, $options: "i" } },
        { "metadata.userEmail": { $regex: escaped, $options: "i" } },
        { "metadata.prompt": { $regex: escaped, $options: "i" } }
      ];
    }

    const db = getDatabase();
    const uploadsBucket = getUploadBucket();
    const generatedImageBucket = getGeneratedImageBucket();

    const fetchLimit = skip + limit;

    const [
      uploadedFiles,
      generatedImages,
      uploadedTotal,
      generatedTotal
    ] = await Promise.all([
      uploadsBucket
        .find(filter as any)
        .sort({ uploadDate: -1 })
        .limit(fetchLimit)
        .toArray(),

      generatedImageBucket
        .find(filter as any)
        .sort({ uploadDate: -1 })
        .limit(fetchLimit)
        .toArray(),

      db.collection("uploads.files").countDocuments(filter),
      db.collection("generatedImages.files").countDocuments(filter)
    ]);

    const combinedFiles = [
      ...uploadedFiles.map((file) => ({
        file,
        fileType: "upload" as const
      })),
      ...generatedImages.map((file) => ({
        file,
        fileType: "generated-image" as const
      }))
    ]
      .sort(
        (a, b) =>
          new Date(b.file.uploadDate).getTime() -
          new Date(a.file.uploadDate).getTime()
      )
      .slice(skip, skip + limit);

    const userIds = [
      ...new Set(
        combinedFiles
          .map(({ file }) => String(file.metadata?.userId || ""))
          .filter((id) => mongoose.isValidObjectId(id))
      )
    ];

    const uploaderUsers = userIds.length
      ? await User.find({
          _id: {
            $in: userIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            )
          }
        })
          .select("name email")
          .lean()
      : [];

    const uploaderMap = new Map(
      uploaderUsers.map((user) => [
        String(user._id),
        {
          name: user.name,
          email: user.email
        }
      ])
    );

    const files = combinedFiles.map(({ file, fileType }) => {
      const metadata = file.metadata || {};
      const fileId = String(file._id);
      const isGenerated = fileType === "generated-image";
      const endpoint = isGenerated ? "/api/images" : "/api/files";
      const uploader = uploaderMap.get(
        String(metadata.userId || "")
      );

      return {
        fileId,
        _id: fileId,
        fileType,
        filename:
          metadata.originalName ||
          file.filename ||
          (isGenerated ? "Generated image" : "Unnamed file"),
        contentType:
          metadata.contentType ||
          (isGenerated
            ? "image/jpeg"
            : "application/octet-stream"),
        size: file.length,
        uploadedAt: metadata.uploadedAt || file.uploadDate,
        uploadDate: file.uploadDate,
        userId: metadata.userId || "",
        userEmail: metadata.userEmail || uploader?.email || "",
        uploader: uploader || {
          name: "Unknown user",
          email: metadata.userEmail || ""
        },
        conversationId: metadata.conversationId || "",
        questionId: metadata.questionId || "",
        prompt: metadata.prompt || "",
        previewUrl: `${endpoint}/${fileId}`,
        downloadUrl: `${endpoint}/${fileId}?download=true`
      };
    });

    const total = uploadedTotal + generatedTotal;

    res.json({
      success: true,
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin files error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load uploaded files"
    });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const filter: Record<string, unknown> = {};

    if (search) {
      const escaped = escapeRegex(search);

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin users error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load users"
    });
  }
});

router.get("/users/:userId/details", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
      return;
    }

    const user = await User.findById(req.params.userId)
      .select("name username email role createdAt updatedAt")
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    const userId = String(user._id);

    const questionFilter = user.email
      ? {
          $or: [
            { userId },
            { userEmail: user.email }
          ]
        }
      : { userId };

    const db = getDatabase();

    const [
      questions,
      conversations,
      messages,
      totalUploads,
      totalGeneratedImages
    ] = await Promise.all([
      Question.find(questionFilter)
        .select(
          "userId userEmail chatId question solution1 solution2 judge status errorMessage attachments createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .lean(),

      Conversation.find({ userId: user._id })
        .select("conversationId title turns createdAt updatedAt")
        .sort({ updatedAt: -1 })
        .lean(),

      Message.find({ userId: user._id })
        .select("conversationId question response status createdAt updatedAt")
        .sort({ createdAt: -1 })
        .lean(),

      db.collection("uploads.files").countDocuments({
        "metadata.userId": userId
      }),

      db.collection("generatedImages.files").countDocuments({
        "metadata.userId": userId
      })
    ]);

    res.json({
      success: true,
      user,
      questions,
      conversations,
      messages,
      summary: {
        totalQuestions: questions.length,
        totalConversations: conversations.length,
        totalMessages: messages.length,
        totalUploads,
        totalGeneratedImages,
        totalFiles: totalUploads + totalGeneratedImages
      }
    });
  } catch (error) {
    console.error("Admin user details error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load this user's history"
    });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const [conversations, total] = await Promise.all([
      Conversation.find()
        .populate("userId", "name email")
        .select("conversationId userId title turns createdAt updatedAt")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Conversation.countDocuments()
    ]);

    res.json({
      success: true,
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin conversations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load conversations"
    });
  }
});

router.get("/questions", async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : "";

    const filter: Record<string, unknown> = {};

    if (["pending", "completed", "failed"].includes(status)) {
      filter.status = status;
    }

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .select(
          "userId userEmail chatId question solution1 solution2 judge status errorMessage attachments createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Question.countDocuments(filter)
    ]);

    res.json({
      success: true,
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin questions error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load questions"
    });
  }
});

router.get("/users/:userId/conversations", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
      return;
    }

    const conversations = await Conversation.find({
      userId: req.params.userId
    })
      .select("conversationId title turns createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error("Admin user conversations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load this user's conversations"
    });
  }
});

export default router;

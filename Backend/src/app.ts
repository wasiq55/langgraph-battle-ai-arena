
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import runGraph, { runGraphStream } from "./ai/graph.ai.js";
import authRoutes from "./routes/auth.routes.js";
import { requireAuth } from "./middleware/auth.js";
import adminRoutes from "./routes/admin.routes.js";
import Conversation from "./models/Conversation.js";
import Question from "./models/Question.js";
import User from "./models/User.js";
import type { AuthenticatedRequest } from "./middleware/auth.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://wasiq55.github.io"
];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.some(
        allowed => origin === allowed || origin.startsWith(allowed + "/")
      )
    ) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024,
    fields: 20,
    fieldSize: 1024 * 1024
  }
});

const MAX_EXTRACTED_CHARS = 50000;

const codeExtensions = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".java", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".php", ".go", ".rs", ".rb", ".swift",
  ".kt", ".html", ".css", ".scss", ".sql",
  ".sh", ".bat", ".ps1", ".xml", ".yaml", ".yml",
  ".toml", ".ini", ".log"
]);

const imageExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".webp"
]);

const audioExtensions = new Set([
  ".mp3", ".wav", ".m4a", ".ogg", ".flac",
  ".mpga", ".mpeg"
]);

const videoExtensions = new Set([
  ".mp4", ".mov", ".webm"
]);

type StoredAttachment = {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
};

type InvokeRequest = express.Request & {
  files?: Express.Multer.File[];
  storedAttachments?: StoredAttachment[];
};

function getUploadBucket() {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB is not connected.");
  }

  return new GridFSBucket(db, {
    bucketName: "uploads"
  });
}

function limitText(value: string) {
  if (value.length <= MAX_EXTRACTED_CHARS) {
    return value;
  }

  return value.slice(0, MAX_EXTRACTED_CHARS) +
    "\n\n[Content truncated because the extraction limit was reached.]";
}

function getGroqKey() {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY is missing from the backend environment.");
  }

  return key;
}

async function groqVision(
  buffer: Buffer,
  mimeType: string,
  question: string
): Promise<string> {
  const supportedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  const normalizedMimeType = mimeType
    .toLowerCase()
    .split(";")[0];

  if (!supportedMimeTypes.has(normalizedMimeType)) {
    throw new Error(
      `Unsupported image format: ${normalizedMimeType}. Please upload a JPEG, PNG, or WebP image.`
    );
  }

  const apiKey = getGroqKey();

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: question
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${normalizedMimeType};base64,${buffer.toString("base64")}`
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_completion_tokens: 1024
      })
    }
  );

  const data = await response.json() as {
    choices?: {
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }[];
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      `Image analysis failed: ${data.error?.message || response.statusText}`
    );
  }

  const content = data.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content || "No image description returned.";
  }

  if (Array.isArray(content)) {
    return content
      .map(part => part.text || "")
      .filter(Boolean)
      .join("\n");
  }

  return "No image description returned.";
}

async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();

  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "text");
  form.append(
    "file",
    new Blob([buffer], {
      type: mimeType || "application/octet-stream"
    }),
    filename
  );

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqKey()}`
      },
      body: form
    }
  );

  const result = await response.text();

  if (!response.ok) {
    throw new Error(`Audio transcription failed: ${result}`);
  }

  return result;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("FFmpeg is unavailable on this server."));
      return;
    }

    const child = spawn(ffmpegPath, args);
    let errorOutput = "";

    child.stderr.on("data", chunk => {
      errorOutput += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`Video processing failed: ${errorOutput.slice(-2000)}`)
        );
      }
    });
  });
}

async function processVideo(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "battle-arena-")
  );

  try {
    const extension = path.extname(filename).toLowerCase() || ".mp4";
    const inputPath = path.join(directory, `input${extension}`);

    await writeFile(inputPath, buffer);

    const transcript = await transcribeAudio(
      buffer,
      filename,
      mimeType || "video/mp4"
    );

    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", "fps=1/10,scale=768:-1",
      "-frames:v", "3",
      path.join(directory, "frame-%02d.jpg")
    ]);

    const frameFiles = (await readdir(directory))
      .filter(name => /^frame-\d+\.jpg$/.test(name))
      .sort()
      .slice(0, 3);

    const descriptions: string[] = [];

    for (const frameFile of frameFiles) {
      const frame = await readFile(path.join(directory, frameFile));

      const description = await groqVision(
        frame,
        "image/jpeg",
        "Describe the important visual content in this video frame. " +
        "Mention visible actions, objects, text, and scene changes."
      );

      descriptions.push(`${frameFile}: ${description}`);
    }

    return [
      "Video audio transcript:",
      transcript,
      "Video frame descriptions:",
      ...descriptions
    ].join("\n\n");
  } finally {
    await rm(directory, {
      recursive: true,
      force: true
    });
  }
}

async function extractFileContent(
  file: Express.Multer.File
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype || "application/octet-stream";

  if (
    extension === ".txt" ||
    extension === ".md" ||
    extension === ".json" ||
    extension === ".csv" ||
    codeExtensions.has(extension) ||
    mimeType.startsWith("text/")
  ) {
    return limitText(file.buffer.toString("utf-8"));
  }

  if (extension === ".pdf") {
    const parser = new PDFParse({
      data: file.buffer
    });

    try {
      const result = await parser.getText();
      const text = result.text.trim();

      if (!text) {
        return "No selectable text was found in this PDF. It may be scanned or image-based and require OCR.";
      }

      return limitText(text);
    } finally {
      await parser.destroy();
    }
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({
      buffer: file.buffer
    });

    return limitText(result.value);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    const workbook = XLSX.read(file.buffer, {
      type: "buffer"
    });

    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });

    return limitText(sheets.join("\n\n"));
  }

  if (
    imageExtensions.has(extension) ||
    mimeType.startsWith("image/")
  ) {
    return await groqVision(
      file.buffer,
      mimeType,
      "Analyze this uploaded image carefully. Describe its contents, " +
      "visible text, objects, and any relevant details."
    );
  }

  if (audioExtensions.has(extension)) {
    return limitText(
      await transcribeAudio(file.buffer, file.originalname, mimeType)
    );
  }

  if (videoExtensions.has(extension)) {
    return limitText(
      await processVideo(file.buffer, file.originalname, mimeType)
    );
  }

  throw new Error(
    `Unsupported file type: ${file.originalname}. The file is stored, but its contents cannot currently be analyzed automatically.`
  );
}

async function storeUploadedFiles(
  req: express.Request,
  questionRecordId: string
): Promise<StoredAttachment[]> {
  const authenticatedRequest = req as AuthenticatedRequest;
  const invokeRequest = req as InvokeRequest;
  const authUser = authenticatedRequest.authUser;
  const files = invokeRequest.files || [];

  const conversationId =
    typeof req.body?.conversationId === "string"
      ? req.body.conversationId.trim()
      : "";

  if (!authUser) {
    throw new Error("Authenticated user not found.");
  }

  if (!conversationId) {
    throw new Error("Conversation ID is missing.");
  }

  const bucket = getUploadBucket();
  const stored: StoredAttachment[] = [];

  try {
    for (const file of files) {
      const fileId = new ObjectId();
      const uploadedAt = new Date();
      const contentType = file.mimetype || "application/octet-stream";

      const metadata = {
        userId: String(authUser.userId),
        userEmail: authUser.email || "",
        conversationId,
        questionId: questionRecordId,
        originalName: file.originalname,
        contentType,
        size: file.size,
        uploadedAt
      };

      await new Promise<void>((resolve, reject) => {
        const stream = bucket.openUploadStream(file.originalname, {
          id: fileId,
          contentType,
          metadata
        });

        stream.once("error", reject);
        stream.once("finish", resolve);
        stream.end(file.buffer);
      });

      stored.push({
        fileId: fileId.toString(),
        filename: file.originalname,
        contentType,
        size: file.size,
        uploadedAt
      });
    }

    await Question.findByIdAndUpdate(questionRecordId, {
      $set: {
        attachments: stored
      }
    });

    invokeRequest.storedAttachments = stored;

    return stored;
  } catch (error) {
    await Promise.allSettled(
      stored.map(file =>
        bucket.delete(new ObjectId(file.fileId))
      )
    );

    throw error;
  }
}

async function prepareProblem(req: express.Request): Promise<string> {
  const input =
    typeof req.body?.input === "string"
      ? req.body.input.trim()
      : "";

  const files = (req as InvokeRequest).files || [];

  if (!input && files.length === 0) {
    throw new Error("Please enter a prompt or upload at least one file.");
  }

  let problem = input || "Please analyze the attached files.";

  for (const file of files) {
    try {
      const extractedContent = await extractFileContent(file);

      problem +=
        `\n\nAttachment: ${file.originalname}\n` +
        `Extracted content or media analysis:\n${extractedContent}\n`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error(`Could not analyze ${file.originalname}:`, message);

      problem +=
        `\n\nAttachment: ${file.originalname}\n` +
        `Content extraction was unsuccessful. The file has been stored ` +
        `and is available for download. Error: ${message}\n`;
    }
  }

  return limitText(problem);
}

function handleUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    next();
    return;
  }

  upload.array("files", 10)(req, res, error => {
    if (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }

    next();
  });
}

async function createPendingRequest(
  req: express.Request
): Promise<string> {
  const authUser = (req as AuthenticatedRequest).authUser;

  if (!authUser) {
    throw new Error("Authenticated user not found.");
  }

  const files = (req as InvokeRequest).files || [];
  const attachmentNames = files.map(file => file.originalname);

  const input =
    typeof req.body?.input === "string"
      ? req.body.input.trim()
      : "";

  const question = (
    input ||
    (attachmentNames.length
      ? `Analyze the attached files: ${attachmentNames.join(", ")}`
      : "Analyze the request.")
  ).slice(0, 60000);

  if (!req.body || typeof req.body !== "object") {
    req.body = {};
  }

  let conversationId =
    typeof req.body.conversationId === "string"
      ? req.body.conversationId.trim()
      : "";

  if (!conversationId) {
    conversationId = randomUUID();
    req.body.conversationId = conversationId;
  }

  try {
    const record = await Question.create({
      userId: String(authUser.userId),
      userEmail: authUser.email || "",
      chatId: conversationId,
      question,
      attachments: [],
      status: "pending"
    });

    return record._id.toString();
  } catch (error) {
    console.error("Could not create pending question record:", error);
    throw new Error("Could not save the question to the database.");
  }
}

async function saveCompletedRequest(
  req: express.Request,
  result: {
    solution_1?: string;
    solution_2?: string;
    judge?: unknown;
  },
  questionRecordId: string
): Promise<void> {
  const authUser = (req as AuthenticatedRequest).authUser;

  if (!authUser) {
    throw new Error("Authenticated user not found.");
  }

  const files = (req as InvokeRequest).files || [];
  const attachmentNames = files.map(file => file.originalname);
  const attachments =
    (req as InvokeRequest).storedAttachments || [];

  const input =
    typeof req.body?.input === "string"
      ? req.body.input.trim()
      : "";

  const question = (
    input ||
    (attachmentNames.length
      ? `Analyze the attached files: ${attachmentNames.join(", ")}`
      : "Analyze the request.")
  ).slice(0, 60000);

  const conversationId =
    typeof req.body?.conversationId === "string"
      ? req.body.conversationId.trim()
      : "";

  await Question.findByIdAndUpdate(questionRecordId, {
    $set: {
      solution1: result.solution_1 || "",
      solution2: result.solution_2 || "",
      judge: result.judge ?? null,
      status: "completed",
      errorMessage: ""
    }
  });

  if (!conversationId) {
    console.warn(
      "Conversation history was not saved: conversationId is missing."
    );
    return;
  }

  await Conversation.findOneAndUpdate(
    {
      userId: authUser.userId,
      conversationId
    },
    {
      $setOnInsert: {
        userId: authUser.userId,
        conversationId,
        title: question.slice(0, 80) || "New chat"
      },
      $push: {
        turns: {
          question,
          solution_1: result.solution_1 || "",
          solution_2: result.solution_2 || "",
          judge: result.judge ?? null,
          attachments,
          createdAt: new Date()
        }
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

async function markRequestFailed(
  questionRecordId: string | null,
  errorMessage: string
): Promise<void> {
  if (!questionRecordId) {
    return;
  }

  try {
    await Question.findByIdAndUpdate(questionRecordId, {
      $set: {
        status: "failed",
        errorMessage: errorMessage.slice(0, 2000)
      }
    });
  } catch (error) {
    console.error("Could not mark question as failed:", error);
  }
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "LangGraph Battle AI Arena backend is running"
  });
});

app.get(
  "/api/files/:fileId",
  requireAuth,
  async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.fileId)) {
        res.status(400).json({
          success: false,
          message: "Invalid file ID."
        });
        return;
      }

      const authUser = (req as AuthenticatedRequest).authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required."
        });
        return;
      }

      const bucket = getUploadBucket();
      const fileId = new ObjectId(req.params.fileId);

      const matches = await bucket.find({
        _id: fileId
      }).toArray();

      const file = matches[0];

      if (!file) {
        res.status(404).json({
          success: false,
          message: "File not found."
        });
        return;
      }

      const metadata = file.metadata || {};
      const isOwner =
        String(metadata.userId) === String(authUser.userId);

      let isAdmin = false;

      if (!isOwner) {
        const user = await User.findById(authUser.userId)
          .select("role")
          .lean();

        isAdmin = user?.role === "admin";
      }

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "You are not allowed to access this file."
        });
        return;
      }

      const filename = String(
        metadata.originalName || file.filename || "download"
      ).replace(/[\r\n"\\]/g, "_");

      const contentType = String(
        metadata.contentType ||
        file.contentType ||
        "application/octet-stream"
      ).split(";")[0].trim().toLowerCase();

      const inlineTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/mp4",
        "audio/aac",
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ]);

      const forceDownload = req.query.download === "true";

      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${!forceDownload && inlineTypes.has(contentType) ? "inline" : "attachment"}; filename="${filename}"`
      );
      res.setHeader("Cache-Control", "private, no-store");

      const downloadStream = bucket.openDownloadStream(fileId);

      downloadStream.on("error", error => {
        console.error("GridFS download error:", error);

        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy(error);
        }
      });

      downloadStream.pipe(res);
    } catch (error) {
      console.error("File retrieval error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to retrieve file."
        });
      }
    }
  }
);

app.post(
  "/invoke",
  requireAuth,
  handleUpload,
  async (req, res) => {
    let questionRecordId: string | null = null;

    try {
      questionRecordId = await createPendingRequest(req);

      await storeUploadedFiles(req, questionRecordId);

      const problem = await prepareProblem(req);
      const result = await runGraph(problem);

      try {
        await saveCompletedRequest(req, result, questionRecordId);
      } catch (error) {
        console.error("Could not save completed AI request:", error);
      }

      res.status(200).json({
        success: true,
        message: "Graph executed successfully",
        result
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error("Graph execution failed:", error);

      await markRequestFailed(questionRecordId, message);

      res.status(
        message.startsWith("Please enter") ? 400 : 500
      ).json({
        success: false,
        message: "Graph execution failed",
        error: message
      });
    }
  }
);

app.post(
  "/invoke/stream",
  requireAuth,
  handleUpload,
  async (req, res) => {
    let questionRecordId: string | null = null;

    try {
      questionRecordId = await createPendingRequest(req);

      await storeUploadedFiles(req, questionRecordId);

      const problem = await prepareProblem(req);

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const emit = (event: unknown) => {
        if (!res.destroyed && !res.writableEnded) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };

      req.on("close", () => {
        if (!res.writableEnded) {
          console.log("Streaming client disconnected.");
        }
      });

      console.log("Starting streaming graph execution...");

      const result = await runGraphStream(problem, emit);

      try {
        await saveCompletedRequest(req, result, questionRecordId);
      } catch (error) {
        console.error(
          "Could not save completed streaming request:",
          error
        );
      }

      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.error("Streaming graph execution failed:", error);

      await markRequestFailed(questionRecordId, message);

      if (res.headersSent) {
        if (!res.destroyed && !res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              message
            })}\n\n`
          );
          res.end();
        }
      } else {
        res.status(
          message.startsWith("Please enter") ? 400 : 500
        ).json({
          success: false,
          message: "Graph execution failed",
          error: message
        });
      }
    }
  }
);

export default app;

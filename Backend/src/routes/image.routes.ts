
import { Router } from "express";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import {
  requireAuth,
  type AuthenticatedRequest
} from "../middleware/auth.js";

const router = Router();

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const IMAGE_BUCKET = "generatedImages";

function getDatabase() {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB is not connected.");
  }

  return db;
}

function getImageBucket() {
  return new GridFSBucket(getDatabase(), {
    bucketName: IMAGE_BUCKET
  });
}

function getAuthenticatedUserId(req: AuthenticatedRequest) {
  const authUser = req.authUser;

  if (!authUser?.userId) {
    throw new Error("Authentication required.");
  }

  return authUser.userId;
}

router.post(
  "/generate",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    let savedFileId: ObjectId | null = null;

    try {
      const userId = getAuthenticatedUserId(req);

      const prompt =
        typeof req.body?.prompt === "string"
          ? req.body.prompt.trim()
          : "";

      const conversationId =
        typeof req.body?.conversationId === "string"
          ? req.body.conversationId.trim()
          : "";

      if (!prompt) {
        res.status(400).json({
          success: false,
          message: "Please enter an image prompt."
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          message: "Conversation ID is required."
        });
        return;
      }

      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        res.status(500).json({
          success: false,
          message: "Cloudflare image generation is not configured."
        });
        return;
      }

      await Conversation.findOneAndUpdate(
        {
          userId,
          conversationId
        },
        {
          $setOnInsert: {
            userId,
            conversationId,
            title: `Image: ${prompt}`.slice(0, 80)
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      const cloudflareResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt })
        }
      );

      const cloudflareData = await cloudflareResponse
        .json()
        .catch(() => null);

      if (
        !cloudflareResponse.ok ||
        cloudflareData?.success === false ||
        typeof cloudflareData?.result?.image !== "string"
      ) {
        const errorMessage =
          cloudflareData?.errors
            ?.map((error: { message?: string }) => error.message)
            .filter(Boolean)
            .join(", ") ||
          "Cloudflare could not generate the image.";

        res.status(502).json({
          success: false,
          message: errorMessage
        });
        return;
      }

      const imageBuffer = Buffer.from(
        cloudflareData.result.image,
        "base64"
      );

      if (!imageBuffer.length) {
        res.status(502).json({
          success: false,
          message: "Cloudflare returned an empty image."
        });
        return;
      }

      const bucket = getImageBucket();
      const uploadedAt = new Date();
      const filename = `generated-${Date.now()}.jpg`;

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: "image/jpeg",
        metadata: {
          userId,
          conversationId,
          prompt,
          contentType: "image/jpeg",
          size: imageBuffer.length,
          createdAt: uploadedAt
        }
      });

      savedFileId = uploadStream.id as ObjectId;

      await new Promise<void>((resolve, reject) => {
        uploadStream.once("finish", resolve);
        uploadStream.once("error", reject);
        uploadStream.end(imageBuffer);
      });

      const imageRecord = {
        type: "generated-image",
        fileId: savedFileId.toString(),
        filename,
        contentType: "image/jpeg",
        size: imageBuffer.length,
        prompt,
        uploadedAt
      };

      await Conversation.findOneAndUpdate(
        {
          userId,
          conversationId
        },
        {
          $push: {
            turns: {
              question: prompt,
              solution_1: "Image generated successfully.",
              solution_2: "",
              judge: null,
              attachments: [imageRecord],
              createdAt: uploadedAt
            }
          }
        },
        {
          new: true
        }
      );

      res.status(200).json({
        success: true,
        message: "Image generated and saved successfully.",
        imageUrl: `/api/images/${savedFileId.toString()}`,
        fileId: savedFileId.toString(),
        prompt,
        conversationId,
        attachment: imageRecord
      });
    } catch (error) {
      if (savedFileId && mongoose.connection.db) {
        try {
          await getImageBucket().delete(savedFileId);
        } catch {}
      }

      console.error("Image generation error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while generating the image."
        });
      }
    }
  }
);

router.get(
  "/:fileId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const { fileId } = req.params;

      if (!ObjectId.isValid(fileId)) {
        res.status(400).json({
          success: false,
          message: "Invalid image ID."
        });
        return;
      }

      const objectId = new ObjectId(fileId);
      const bucket = getImageBucket();

      const file = await bucket
        .find({ _id: objectId })
        .limit(1)
        .next();

      if (!file) {
        res.status(404).json({
          success: false,
          message: "Image not found in generatedImages."
        });
        return;
      }

      const ownerId = String(file.metadata?.userId || "");
      let isAdmin = false;

      if (ownerId !== userId) {
        const currentUser = await User.findById(userId)
          .select("role")
          .lean();

        isAdmin = currentUser?.role === "admin";

        if (!isAdmin) {
          res.status(403).json({
            success: false,
            message: "You are not allowed to access this image."
          });
          return;
        }
      }

      const filename = String(file.filename || "generated-image.jpg")
        .replace(/["\\\r\n]/g, "_");

      res.setHeader(
        "Content-Type",
        file.contentType ||
          file.metadata?.contentType ||
          "image/jpeg"
      );

      const shouldDownload = req.query.download === "true";

      res.setHeader(
        "Content-Disposition",
        `${shouldDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      res.setHeader("Cache-Control", "private, no-store");

      const downloadStream = bucket.openDownloadStream(objectId);

      downloadStream.on("error", (error) => {
        console.error("Image download error:", error);

        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Unable to retrieve the image."
          });
        } else {
          res.destroy(error);
        }
      });

      downloadStream.pipe(res);
    } catch (error) {
      console.error("Image retrieval error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to retrieve the image."
        });
      }
    }
  }
);

export default router;

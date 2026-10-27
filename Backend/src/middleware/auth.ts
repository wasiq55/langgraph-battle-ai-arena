
import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";


export interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
    role: "user" | "admin";
  };
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const token = authorization.slice(7);
    const decoded = jwt.verify(token, getJwtSecret());

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string" ||
      (decoded.role !== "user" && decoded.role !== "admin")
    ) {
      res.status(401).json({ message: "Invalid authentication token" });
      return;
    }

    (req as AuthenticatedRequest).authUser = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const user = (req as AuthenticatedRequest).authUser;

  if (!user || user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};

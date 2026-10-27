
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

const createToken = (user: {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: "user" | "admin";
}) => {
  return jwt.sign(
    { email: user.email, role: user.role },
    getJwtSecret(),
    {
      subject: user._id.toString(),
      expiresIn: "7d"
    }
  );
};

import mongoose from "mongoose";

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      res.status(400).json({ message: "Name, email and password are required" });
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length > 100) {
      res.status(400).json({ message: "Enter a valid name" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ message: "Enter a valid email address" });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        message: "Password must be between 8 and 128 characters"
      });
      return;
    }

    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      res.status(409).json({ message: "Email is already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: "user"
    });

    const token = createToken(user);

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: "Email is already registered" });
      return;
    }

    console.error("Signup error:", error);
    res.status(500).json({ message: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = createToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Could not log in" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;

    if (!authUser) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = await User.findById(authUser.userId).select(
      "_id name email role createdAt"
    );

    if (!user) {
      res.status(401).json({ message: "User account not found" });
      return;
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Could not load profile" });
  }
});

export default router;

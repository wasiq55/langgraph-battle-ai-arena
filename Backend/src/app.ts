
import express from "express";
import runGraph from "./ai/graph.ai.js";
import cors from "cors";

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://wasiq55.github.io"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(
            allowed => origin === allowed || origin.startsWith(allowed + "/")
        )) {
            callback(null, true);
        } else {
            callback(new Error("Origin not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(express.json());

app.get("/", async (req, res) => {
    try {
        const result = await runGraph(
            "Write a code for Factorial function in JavaScript"
        );
        res.json(result);
    } catch (error) {
        console.error("Graph execution failed:", error);
        res.status(500).json({
            success: false,
            message: "Graph execution failed"
        });
    }
});

app.post("/invoke", async (req, res) => {
    try {
        const { input } = req.body;

        if (typeof input !== "string" || !input.trim()) {
            res.status(400).json({
                success: false,
                message: "A valid input string is required"
            });
            return;
        }

        const result = await runGraph(input);

        res.status(200).json({
            message: "Graph executed successfully",
            success: true,
            result
        });
    } catch (error) {
        console.error("Graph execution failed:", error);
        res.status(500).json({
            success: false,
            message: "Graph execution failed"
        });
    }
});

export default app;

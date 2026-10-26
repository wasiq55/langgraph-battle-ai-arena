
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import {
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import runGraph from "./ai/graph.ai.js";

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

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 10,
        fileSize: 10 * 1024 * 1024
    }
});

const MAX_EXTRACTED_CHARS = 50000;

const codeExtensions = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".java", ".c", ".cpp", ".h", ".hpp",
    ".cs", ".php", ".go", ".rs", ".rb", ".swift",
    ".kt", ".html", ".css", ".scss", ".sql",
    ".sh", ".bat", ".ps1", ".xml", ".yaml", ".yml",
    ".toml", ".ini", ".env.example", ".log"
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
    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${getGroqKey()}`,
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
                                    url: `data:${mimeType};base64,${buffer.toString("base64")}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.2
            })
        }
    );

    const data = await response.json() as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
    };

    if (!response.ok) {
        throw new Error(
            `Image analysis failed: ${data.error?.message || response.statusText}`
        );
    }

    return data.choices?.[0]?.message?.content || "No image description returned.";
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
        new Blob([buffer], { type: mimeType || "application/octet-stream" }),
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
                reject(new Error(`Video processing failed: ${errorOutput.slice(-2000)}`));
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
        const inputPath = path.join(
            directory,
            `input${path.extname(filename).toLowerCase()}`
        );

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
        await rm(directory, { recursive: true, force: true });
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
        const parser = new PDFParse({ data: file.buffer });

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
        const workbook = XLSX.read(file.buffer, { type: "buffer" });

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
        `Unsupported file type: ${file.originalname}. Please upload a supported document, code, image, audio, or video file.`
    );
}

app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "LangGraph Battle AI Arena backend is running"
    });
});

app.post(
    "/invoke",
    (req, res, next) => {
        const contentType = req.headers["content-type"] || "";

        if (contentType.includes("multipart/form-data")) {
            upload.array("files", 10)(req, res, error => {
                if (error) {
                    res.status(400).json({
                        success: false,
                        message: error.message
                    });
                    return;
                }

                void handleInvoke(req, res);
            });

            return;
        }

        next();
    },
    async (req, res) => {
        await handleInvoke(req, res);
    }
);

async function handleInvoke(
    req: express.Request,
    res: express.Response
) {
    try {

        const input = typeof req.body?.input === "string"
            ? req.body.input.trim()
            : "";

        const files = (req as express.Request & {
            files?: Express.Multer.File[];
        }).files || [];

        if (!input && files.length === 0) {
            res.status(400).json({
                success: false,
                message: "Please enter a prompt or upload at least one file."
            });
            return;
        }

        let problem = input || "Please analyze the attached files.";


        for (const file of files) {
            console.log("Processing attachment:", file.originalname);

            const extractedContent = await extractFileContent(file);

            problem +=
                `\n\nAttachment: ${file.originalname}\n` +
                `Extracted content or media analysis:\n` +
                `${extractedContent}\n`;

            console.log("Attachment processed:", file.originalname);
        }

        problem = limitText(problem);

        console.log("Starting LangGraph execution...");
        console.log("Attached files:", files.length);
        console.log("Prompt length:", problem.length);

        const result = await runGraph(problem);

        console.log("LangGraph execution completed successfully");

        res.status(200).json({
            success: true,
            message: "Graph executed successfully",
            result
        });
    } catch (error) {
        console.error("Graph execution failed:", error);

        res.status(500).json({
            success: false,
            message: "Graph execution failed",
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

export default app;

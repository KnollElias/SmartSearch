const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const apiUrl = "http://127.0.0.1:11434/api/generate"; // LLM
const contextDir = path.join(__dirname, "../dataset");
const history = []; // Chat history

// Middleware
app.use(cors({ origin: "http://localhost:3000" })); // Allow requests from local client
app.use(bodyParser.json());

// Configure file uploads
const upload = multer({ dest: contextDir });

// Ensure dataset directory exists
if (!fs.existsSync(contextDir)) {
  fs.mkdirSync(contextDir, { recursive: true });
}

// Function to load context
function loadContext(extraContext = "") {
  let contextTexts = [extraContext]; // Start with user-provided context

  // Read all text files in the dataset folder
  const files = fs.readdirSync(contextDir);
  for (const file of files) {
    if (file.endsWith(".txt") || file.endsWith(".json")) {
      const filePath = path.join(contextDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      contextTexts.push(content);
    }
  }

  return contextTexts.join("\n"); // Merge all files into one context string
}

// POST /ask - Handle model queries
app.post("/ask", async (req, res) => {
  const { question, extra_context = "" } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question field is required" });
  }

  const context = loadContext(extra_context);
  const systemPrompt = `Use the following context for better accuracy:\n${context}\n`;

  history.push({ role: "system", content: systemPrompt });
  history.push({ role: "user", content: question });

  try {
    const response = await axios.post(apiUrl, {
      model: "mistral",
      prompt: history.map((msg) => msg.content).join("\n"),
      stream: false,
    });

    const reply = response.data.response;
    history.push({ role: "assistant", content: reply });
    res.json({ reply });
  } catch (error) {
    console.error("Failed to connect to the model:", error.message);
    res
      .status(500)
      .json({ error: `Failed to connect to the model: ${error.message}` });
  }
});

// POST /upload - Handle file uploads
app.post("/upload", upload.single("file"), (req, res) => {
  const { file } = req;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = path.join(contextDir, file.originalname);

  // Rename file to keep its original name
  fs.renameSync(file.path, filePath);
  res.json({ message: `File ${file.originalname} uploaded successfully!` });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

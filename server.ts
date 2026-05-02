import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "leaderboard.json");

app.use(express.json());

interface ScoreEntry {
  address: string;
  score: number;
  lines: number;
}

function getLeaderboard(): ScoreEntry[] {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveLeaderboard(lb: ScoreEntry[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(lb, null, 2));
}

app.get("/api/leaderboard", (req, res) => {
  const lb = getLeaderboard();
  const sorted = lb.sort((a, b) => b.score - a.score);
  res.json(sorted); // Return all, let frontend limit
});

app.post("/api/leaderboard", (req, res) => {
  const { address, score, lines } = req.body;
  if (!address || typeof score !== "number") {
    return res.status(400).json({ error: "Invalid data" });
  }
  
  const lb = getLeaderboard();
  const existing = lb.find(entry => entry.address === address);
  
  if (existing) {
    if (score > existing.score) {
       existing.score = score;
       existing.lines += lines;
    }
  } else {
    lb.push({ address, score, lines });
  }
  
  saveLeaderboard(lb);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

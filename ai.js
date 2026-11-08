/* =========================================================
   FinTracker AI — headline sentiment that runs in the browser
   ---------------------------------------------------------
   Uses Transformers.js (ONNX Runtime in WebAssembly) to run a
   DistilRoBERTa model fine-tuned on financial news
   (labels: negative / neutral / positive).
   Nothing is sent to a server: the model is downloaded once,
   cached by the browser, and runs on the visitor's device.
   ========================================================= */
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

env.allowLocalModels = false; // always load from the Hugging Face Hub

const MODELS = [
  // 1st choice: finance-specific model (3 classes)
  { id: "PengZhang424242/distilroberta-finetuned-financial-news-sentiment-analysis-ONNX", name: "DistilRoBERTa (financial news)" },
  // fallback: general-purpose sentiment model (2 classes)
  { id: "Xenova/distilbert-base-uncased-finetuned-sst-2-english", name: "DistilBERT (general sentiment)" },
];

let classifier = null;
let modelName = "";

async function load(onProgress) {
  if (classifier) return modelName;
  let lastError;
  for (const m of MODELS) {
    try {
      classifier = await pipeline("text-classification", m.id, {
        dtype: "q8", // quantized: ~80 MB instead of ~330 MB
        progress_callback: (p) => {
          if (p.status === "progress" && p.file && p.file.endsWith(".onnx") && onProgress) {
            onProgress(Math.round(p.progress));
          }
        },
      });
      modelName = m.name;
      return modelName;
    } catch (err) {
      console.warn("Model failed to load:", m.id, err);
      lastError = err;
    }
  }
  throw lastError;
}

/* Returns one score per text in the range -1 (negative) … +1 (positive) */
async function classify(texts) {
  if (!classifier) throw new Error("Model not loaded");
  const results = [];
  for (const text of texts) {
    // top_k: null -> probabilities for every label
    const out = await classifier(text.slice(0, 512), { top_k: null });
    const prob = (label) => (out.find((o) => o.label.toLowerCase() === label) || { score: 0 }).score;
    const score = prob("positive") - prob("negative"); // neutral pulls the score toward 0
    const top = out.reduce((a, b) => (b.score > a.score ? b : a));
    results.push({ score, label: top.label.toLowerCase(), confidence: top.score });
  }
  return results;
}

window.FinAI = { load, classify, get modelName() { return modelName; } };
window.dispatchEvent(new Event("finai-ready"));

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI with safe fallback to prevent module loading crashes
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY env variable is not set. AI advisory features will be disabled.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGenAIClient();

// Helper to cover all model requests with robust exponential backoff retry for transient 503 or 429 errors
async function generateContentWithRetry(params: any, retries = 3, initialDelay = 1000) {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const isTransient =
        err.status === "UNAVAILABLE" ||
        err.code === 503 ||
        err.status === "RESOURCE_EXHAUSTED" ||
        err.code === 429 ||
        (err.message && (
          err.message.includes("503") ||
          err.message.includes("high demand") ||
          err.message.includes("temporary") ||
          err.message.includes("429") ||
          err.message.includes("RESOURCE_EXHAUSTED") ||
          err.message.includes("UNAVAILABLE")
        ));

      if (isTransient && attempt < retries) {
        const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(`[Gemini API Retry] Call failed (attempt ${attempt}/${retries}) due to rate limiting or resource exhaustion: ${err.message || err}. Retrying in ${Math.round(backoff)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini service is currently experiencing high demand. Please trigger the operation again in a moment.");
}

// API 1: Calculate automated Quantity Takeoff elements using specified structural prompt
app.post("/api/takeoff/estimate", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(403).json({ error: "Gemini API Key is not configured." });
    }

    const { projectDescription, category, location } = req.body;

    if (!category || !projectDescription) {
      return res.status(400).json({ error: "Missing physical features or categories." });
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `Generate 4 realistic Quantity Takeoff (BOQ) list items for a project in ${location || 'Generic location'} based on: "${projectDescription}". The category of elements to estimate is: "${category}". Provide structural element description, precise geometric quantities, standard Unit (m3, m2, m, kg, pcs), and estimated standard unit prices (USD).`,
      config: {
        systemInstruction: "You are an expert civil engineer and senior quantity surveyor. Generate highly precise, realistic BIM elements with standard pricing and materials.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "Main material category, e.g. Concrete, Steel, Masonry" },
              elementType: { type: Type.STRING, description: "Specific element name with size, e.g. C30 concrete square column 400x400mm" },
              quantity: { type: Type.NUMBER, description: "Measured geometry size or vol/area count" },
              unit: { type: Type.STRING, description: "m3 for volume, m2 for area, kg for weight, pcs for count" },
              unitPrice: { type: Type.NUMBER, description: "Estimated cost per unit in USD" },
              sourceLocation: { type: Type.STRING, description: "Target zone e.g. Level 2 Section B grid C-4" },
              notes: { type: Type.STRING, description: "AI optimization note regarding material performance, weight, or cost saving" }
            },
            required: ["category", "elementType", "quantity", "unit", "unitPrice", "sourceLocation", "notes"]
          }
        }
      }
    });

    const itemsText = response.text ? response.text.trim() : "[]";
    const items = JSON.parse(itemsText);
    res.json({ items });
  } catch (error: any) {
    console.error("Takeoff estimation error:", error);
    res.status(500).json({ error: error.message || "Failed to calculate takeoff estimation items." });
  }
});

// API BCF: BIM Collaboration Format Packet Parser Endpoint
app.post("/api/bcf/parse", (req, res) => {
  try {
    const { rawContent } = req.body;
    if (!rawContent || !rawContent.trim()) {
      return res.status(400).json({ error: "Empty BCF packet content." });
    }

    const trimmed = rawContent.trim();
    let parsedIssue;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // Parse as JSON BCF payload
      const parsed = JSON.parse(trimmed);
      const topic = parsed.topic || {};
      const comment = parsed.comment || {};
      const viewpoint = parsed.viewpoint || {};
      
      parsedIssue = {
        guid: topic.guid || `guid_${Date.now()}`,
        title: topic.title || "Untitled BCF Issue",
        description: topic.description || "No description provided.",
        status: topic.topic_status || "open",
        priority: topic.priority || "high",
        creationDate: topic.creation_date || new Date().toISOString(),
        creationAuthor: topic.creation_author || "BCF Importer",
        assignedTo: topic.assigned_to || "Unassigned Coordinator",
        coordinateX: parseFloat(viewpoint.coordinate_x) || 15.0,
        coordinateY: parseFloat(viewpoint.coordinate_y) || 10.0,
        coordinateZ: parseFloat(viewpoint.coordinate_z) || 2.0,
        discipline1: viewpoint.discipline_1 || "HVAC",
        discipline2: viewpoint.discipline_2 || "Structural",
        comment: comment.text || "Imported coordinates verification requested.",
        synced: false
      };
    } else if (trimmed.includes("<") && trimmed.includes(">")) {
      // Parse as XML Markup content
      const extractXmlTag = (tag: string, text: string): string => {
        const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(text);
        return match ? match[1].trim() : '';
      };

      const guidMatch = /<Topic[^>]+Guid=["']([^"']+)["']/i.exec(trimmed);
      const guid = guidMatch ? guidMatch[1] : `guid_${Date.now()}`;
      
      const statusMatch = /<Topic[^>]+TopicStatus=["']([^"']+)["']/i.exec(trimmed);
      const status = statusMatch ? statusMatch[1] : "open";

      const title = extractXmlTag('Title', trimmed) || 'Untitled XML BCF Issue';
      const description = extractXmlTag('Description', trimmed) || 'No description provided in XML payload.';
      const priority = extractXmlTag('Priority', trimmed) || 'High';
      const creationDate = extractXmlTag('CreationDate', trimmed) || new Date().toISOString();
      const creationAuthor = extractXmlTag('CreationAuthor', trimmed) || 'BCF Importer';
      const assignedTo = extractXmlTag('AssignedTo', trimmed) || 'Unassigned Coordinator';
      
      const coordinateX = parseFloat(extractXmlTag('CoordinateX', trimmed)) || 15.0;
      const coordinateY = parseFloat(extractXmlTag('CoordinateY', trimmed)) || 10.0;
      const coordinateZ = parseFloat(extractXmlTag('CoordinateZ', trimmed)) || 2.0;
      
      const discipline1 = extractXmlTag('Discipline1', trimmed) || 'HVAC';
      const discipline2 = extractXmlTag('Discipline2', trimmed) || 'Structural';
      
      const comment = extractXmlTag('Comment', trimmed) || 'Imported XML comments.';

      parsedIssue = {
        guid,
        title,
        description,
        status,
        priority,
        creationDate,
        creationAuthor,
        assignedTo,
        coordinateX,
        coordinateY,
        coordinateZ,
        discipline1,
        discipline2,
        comment,
        synced: false
      };
    } else {
      return res.status(400).json({ error: "Unrecognized BCF packet. Supported formats: XML (Markup layout) or JSON." });
    }

    res.json({ issue: parsedIssue });
  } catch (error: any) {
    console.error("BCF Parser Error:", error);
    res.status(500).json({ error: error.message || "Failed to parse BCF packet due to spacing or syntactical integrity." });
  }
});

// API 2: AI Clash Advisory resolution guidance
app.post("/api/clash/resolve", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(403).json({ error: "Gemini API Key is not configured." });
    }

    const { title, discipline1, discipline2, severity, coordinateX, coordinateY, coordinateZ } = req.body;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `Resolve this 3D BIM coordination clash:
- Clash Title: ${title}
- Discipline Involved 1: ${discipline1}
- Discipline Involved 2: ${discipline2}
- Severity Level: ${severity}
- Coordinate Location: X: ${coordinateX}, Y: ${coordinateY}, Z: ${coordinateZ} meters.`,
      config: {
        systemInstruction: `You are an expert BIM Manager and Structural/MEP engineering design coordinator. Coordinate clashes by:
1. Identifying which discipline has high priority (e.g. structural elements are immutable; HVAC has sloping gravity drainage rules; electrical cable trays have flexible rerouting).
2. Propose concrete dimensional changes or elevation shifts in meters.
3. Suggest a compliance checklist matching standard international building codes (IBC/ASHRAE).
Provide the response format in clean, descriptive Markdown with bullet points. Avoid promotional statements.`
      }
    });

    res.json({ advice: response.text });
  } catch (error: any) {
    console.error("Clash advisory resolution error:", error);
    res.status(500).json({ error: error.message || "Failed to generate structural resolution advisory." });
  }
});

// Helper for Parsing sheet names when offline or falling back from Gemini AI
function heuristicParse(rawLines: string[], prefix: string, delimiter: string, seqPadding: number) {
  return rawLines.map((line, idx) => {
    const raw = line.trim();
    let discipline = "ARC";
    let zone = "LVL01";
    let docType = "DWG";
    let seqNumberNum = 100 + idx;
    let title = raw;
    let warning = "";

    const upper = raw.toUpperCase();
    if (upper.includes("STR") || upper.includes("S-") || upper.includes("FOUND") || upper.includes("CONCRETE") || upper.includes("REBAR")) {
      discipline = "STR";
    } else if (upper.includes("MEP") || upper.includes("HVAC") || upper.includes("DUCT") || upper.startsWith("M-")) {
      discipline = "MEP";
    } else if (upper.includes("ELE") || upper.includes("LIGHT") || upper.startsWith("E-")) {
      discipline = "ELE";
    } else if (upper.includes("PLB") || upper.includes("DRAIN") || upper.includes("WATER") || upper.startsWith("P-")) {
      discipline = "PLB";
    } else if (upper.includes("CIV") || upper.includes("ROAD") || upper.includes("SITE") || upper.startsWith("C-")) {
      discipline = "CIV";
    } else if (upper.startsWith("A-") || upper.includes("ARCH") || upper.includes("WALL") || upper.includes("PLAN")) {
      discipline = "ARC";
    }

    if (upper.includes("L01") || upper.includes("LVL1") || upper.includes("LEVEL1") || upper.includes("LEVEL 1") || upper.includes("FIRST")) {
      zone = "LVL01";
    } else if (upper.includes("L02") || upper.includes("LVL2") || upper.includes("LEVEL2") || upper.includes("LEVEL 2") || upper.includes("SECOND")) {
      zone = "LVL02";
    } else if (upper.includes("ROOF") || upper.includes("RF")) {
      zone = "ROOF";
    } else if (upper.includes("PODIUM") || upper.includes("PD")) {
      zone = "PODIUM";
    } else if (upper.includes("BASE") || upper.includes("BSMT") || upper.includes("SUB")) {
      zone = "BSMT1";
    }

    if (upper.endsWith(".DWG") || upper.includes("DWG") || upper.includes("CAD")) {
      docType = "DWG";
    } else if (upper.endsWith(".RVT") || upper.includes("RVT") || upper.includes("MODEL")) {
      docType = "RVT";
    } else if (upper.endsWith(".PDF") || upper.includes("PDF") || upper.includes("PRNT")) {
      docType = "PDF";
    } else if (upper.endsWith(".XLS") || upper.includes("EXCEL") || upper.includes("XLSX")) {
      docType = "XLS";
    } else if (upper.includes("DETAIL") || upper.includes("DET") || upper.includes("SEC")) {
      docType = "DET";
    }

    const digitMatch = /\b\d{2,4}\b/.exec(raw);
    if (digitMatch) {
      seqNumberNum = parseInt(digitMatch[0]);
    }

    let clean = raw.replace(/\.(dwg|rvt|pdf|xls|xlsx|csv|txt)/i, '');
    clean = clean.replace(/^[A-Z]-\d{3}\s*/i, '');
    clean = clean.replace(/^S\d{2}\s*/i, '');
    clean = clean.replace(/[-_]/g, ' ').trim();
    if (clean.length > 0) {
      title = clean.charAt(0).toUpperCase() + clean.slice(1);
    } else {
      title = "Drawing Area Layout";
    }

    if (!digitMatch) {
      warning = "No explicit sequence matched; automatically assigned index.";
    }

    const paddedSeq = String(seqNumberNum).padStart(seqPadding, '0');
    const formattedCode = `${prefix}${delimiter}${discipline}${delimiter}${zone}${delimiter}${docType}${delimiter}${paddedSeq}`;

    return {
      id: `sheet_heur_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      originalName: raw,
      formattedCode,
      title,
      discipline,
      zone,
      docType,
      seqNumber: paddedSeq,
      status: warning ? 'warning' : 'valid',
      validationMessage: warning || "Standardized matching ISO-19650 layout indices."
    };
  });
}

// API 3: Standardize drawing names / spreadsheets via Gemini (with heuristic fallback)
app.post("/api/sheets/parse", async (req, res) => {
  try {
    const { rawLines, options } = req.body;
    const delimiter = options?.delimiter || "-";
    const prefix = options?.prefix || "OLY";
    const seqPadding = parseInt(options?.seqPadding) || 3;

    if (!rawLines || !Array.isArray(rawLines)) {
      return res.status(400).json({ error: "Missing rawLines array in body." });
    }

    let parsedItems = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await generateContentWithRetry({
          model: "gemini-3.5-flash",
          contents: `Parse these raw, unstructured sheet names/drawings and extract metadata standardizing them according to ISO-19650 standard naming fields:
${JSON.stringify(rawLines)}

Provide a structured array. For each sheet, you must extract:
- 'originalName': exact name input
- 'title': human clean plain-English sheet title / description (e.g. "Level 1 Ductwork Floor Plan")
- 'discipline': STR (structural), ARC (architectural), MEP (mechanical/electrical/plumbing), ELE (electrical), PLB (plumbing), CIV (civil / site)
- 'zone': e.g. LVL01, LVL02, ROOF, PODIUM, BSMT1
- 'docType': DWG, RVT, PDF, XLS, DET
- 'seqNo': chronological sheet index key e.g. 101, 202

Be precise and complete.`,
          config: {
            systemInstruction: "You are an automated ISO-19650 standard BIM CAD/BIM Librarian. Standardize unstructured names into high-precision structural metadata objects.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalName: { type: Type.STRING },
                  title: { type: Type.STRING },
                  discipline: { type: Type.STRING },
                  zone: { type: Type.STRING },
                  docType: { type: Type.STRING },
                  seqNo: { type: Type.NUMBER },
                  warning: { type: Type.STRING }
                },
                required: ["originalName", "title", "discipline", "zone", "docType", "seqNo"]
              }
            }
          }
        });

        const text = response.text ? response.text.trim() : "[]";
        const geminiItems = JSON.parse(text);
        
        parsedItems = geminiItems.map((item: any, idx: number) => {
          const paddedSeq = String(item.seqNo || (100 + idx)).padStart(seqPadding, '0');
          const formattedCode = `${prefix}${delimiter}${item.discipline}${delimiter}${item.zone}${delimiter}${item.docType}${delimiter}${paddedSeq}`;
          return {
            id: `sheet_gem_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            originalName: item.originalName,
            formattedCode,
            title: item.title || "Standardized Layout",
            discipline: item.discipline || "ARC",
            zone: item.zone || "LVL01",
            docType: item.docType || "DWG",
            seqNumber: paddedSeq,
            status: item.warning ? 'warning' : 'valid',
            validationMessage: item.warning || "Standardized matching ISO-19650 standard specifications."
          };
        });
      } catch (geminiErr) {
        console.warn("Gemini sheets parse failed, using heuristic: ", geminiErr);
        parsedItems = heuristicParse(rawLines, prefix, delimiter, seqPadding);
      }
    } else {
      parsedItems = heuristicParse(rawLines, prefix, delimiter, seqPadding);
    }

    res.json({ sheets: parsedItems });
  } catch (error: any) {
    console.error("Sheets parse error:", error);
    res.status(500).json({ error: error.message || "Failed to parse spreadsheet sheets database." });
  }
});

// API 4: Webhook portal endpoint to trigger script integrations remotely from Dynamo/Revit
app.post("/api/sheets/webhook", (req, res) => {
  try {
    const { token, source, drawings } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing webhook integration token." });
    }

    if (!drawings || !Array.isArray(drawings)) {
      return res.status(400).json({ error: "Invalid webhook payload structure. Expecting 'drawings' key with string array names." });
    }

    console.log(`[Webhook Broker] Received ${drawings.length} records from source pipeline: ${source || "Dynamo Connector"}`);

    const prefix = "OLY";
    const delimiter = "-";
    const seqPadding = 3;
    const formattedSheets = heuristicParse(drawings, prefix, delimiter, seqPadding);

    res.json({
      success: true,
      broker: "BIM-Automation-Broker-Cloud",
      receivedCount: drawings.length,
      sourcePipeline: source || "Revit-Dynamo-Endpoint",
      timestamp: new Date().toISOString(),
      sheets: formattedSheets
    });
  } catch (err: any) {
    console.error("Webhook gateway helper error:", err);
    res.status(500).json({ error: err.message || "Failed to process webhook drawings pipeline trigger." });
  }
});

// Setup Vite development or production static assets server
async function bootstrap() {
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
    console.log(`BIM Construction Portal is online and listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();

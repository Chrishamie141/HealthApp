import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import sax from "sax";
import { Readable, PassThrough } from "stream";
import yauzl from "yauzl";
import iconv from "iconv-lite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use memory storage for small files, but we'll handle the buffer as a stream
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json());

  // API Route to parse Apple Health Export
  app.post("/api/parse-health-data", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const dailyStats: Record<string, any> = {};
      const recentWorkouts: any[] = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const handleXmlStream = (xmlStream: Readable) => {
        const saxStream = sax.createStream(true, { lowercase: false });

        saxStream.on("opentag", (node) => {
          if (node.name === "Record") {
            const r = node.attributes as any;
            const startDate = r.startDate;
            if (!startDate) return;

            const date = new Date(startDate);
            if (date < thirtyDaysAgo) return;

            const dateStr = startDate.split(" ")[0] || startDate.split("T")[0];
            if (!dailyStats[dateStr]) {
              dailyStats[dateStr] = { steps: 0, calories: 0, distance: 0, date: dateStr };
            }

            if (r.type === "HKQuantityTypeIdentifierStepCount") {
              dailyStats[dateStr].steps += parseInt(r.value) || 0;
            } else if (r.type === "HKQuantityTypeIdentifierActiveEnergyBurned") {
              dailyStats[dateStr].calories += parseFloat(r.value) || 0;
            } else if (r.type === "HKQuantityTypeIdentifierDistanceWalkingRunning") {
              dailyStats[dateStr].distance += parseFloat(r.value) || 0;
            }
          } else if (node.name === "Workout") {
            const w = node.attributes as any;
            const startDate = w.startDate;
            if (!startDate) return;

            const date = new Date(startDate);
            if (date < thirtyDaysAgo) return;

            recentWorkouts.push({
              type: w.workoutActivityType,
              duration: w.duration,
              calories: w.totalEnergyBurned,
              date: w.startDate,
            });
          }
        });

        saxStream.on("end", () => {
          if (!res.headersSent) {
            res.json({
              dailyStats: Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date)),
              workouts: recentWorkouts,
            });
          }
        });

        saxStream.on("error", (e) => {
          console.error("SAX Error:", e);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to parse XML data" });
          }
        });

        // Use iconv-lite to decode the stream safely, handling potential encoding issues
        xmlStream.pipe(iconv.decodeStream("utf8")).pipe(saxStream);
      };

      // Check if it's a zip file
      if (req.file.mimetype === "application/zip" || req.file.originalname.endsWith(".zip")) {
        yauzl.fromBuffer(req.file.buffer, { lazyEntries: true }, (err, zipfile) => {
          if (err || !zipfile) {
            console.error("Yauzl Error:", err);
            return res.status(400).json({ error: "Failed to open ZIP file" });
          }

          zipfile.readEntry();
          zipfile.on("entry", (entry) => {
            if (entry.fileName.endsWith("export.xml")) {
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err || !readStream) {
                  return res.status(500).json({ error: "Failed to read export.xml from ZIP" });
                }
                handleXmlStream(readStream);
              });
            } else {
              zipfile.readEntry();
            }
          });

          zipfile.on("end", () => {
            // If we finished the zip and never found export.xml
            setTimeout(() => {
              if (!res.headersSent) {
                res.status(400).json({ error: "export.xml not found in ZIP" });
              }
            }, 1000);
          });
        });
      } else if (req.file.mimetype === "application/json" || req.file.originalname.endsWith(".json")) {
        // For JSON, we'll still use the buffer for now but handle it more safely
        try {
          const content = iconv.decode(req.file.buffer, "utf8");
          const jsonData = JSON.parse(content);
          const healthData = jsonData.HealthData || jsonData;
          
          if (!healthData || (!healthData.Record && !healthData.dailyStats)) {
            return res.status(400).json({ error: "Invalid JSON Health Data format" });
          }

          if (healthData.dailyStats) {
            return res.json(healthData);
          }

          const records = Array.isArray(healthData.Record) ? healthData.Record : [healthData.Record];
          const dailyStatsSync = processRecordsSync(records, thirtyDaysAgo);
          const workoutsSync = processWorkoutsSync(healthData.Workout, thirtyDaysAgo);
          
          res.json({ dailyStats: dailyStatsSync, workouts: workoutsSync });
        } catch (e) {
          console.error("JSON Parse Error:", e);
          res.status(400).json({ error: "Failed to parse JSON file" });
        }
      } else {
        // Assume it's a raw XML file
        const readable = new Readable();
        readable.push(req.file.buffer);
        readable.push(null);
        handleXmlStream(readable);
      }

    } catch (error) {
      console.error("Error parsing health data:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to parse health data" });
      }
    }
  });

  function processRecordsSync(records: any[], thirtyDaysAgo: Date) {
    const dailyStats: Record<string, any> = {};

    records.filter((r: any) => {
      const date = new Date(r.startDate);
      return date >= thirtyDaysAgo;
    }).forEach((r: any) => {
      const dateStr = r.startDate.split(" ")[0] || r.startDate.split("T")[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { steps: 0, calories: 0, distance: 0, date: dateStr };
      }

      if (r.type === "HKQuantityTypeIdentifierStepCount") {
        dailyStats[dateStr].steps += parseInt(r.value) || 0;
      } else if (r.type === "HKQuantityTypeIdentifierActiveEnergyBurned") {
        dailyStats[dateStr].calories += parseFloat(r.value) || 0;
      } else if (r.type === "HKQuantityTypeIdentifierDistanceWalkingRunning") {
        dailyStats[dateStr].distance += parseFloat(r.value) || 0;
      }
    });

    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
  }

  function processWorkoutsSync(workoutData: any, thirtyDaysAgo: Date) {
    const workouts = Array.isArray(workoutData) ? workoutData : (workoutData ? [workoutData] : []);
    return workouts
      .filter((w: any) => new Date(w.startDate) >= thirtyDaysAgo)
      .map((w: any) => ({
        type: w.workoutActivityType,
        duration: w.duration,
        calories: w.totalEnergyBurned,
        date: w.startDate,
      }));
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

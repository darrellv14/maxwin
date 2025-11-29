import http from "http";
import url from "url";
import path from "path";
import fs from "fs";

// Load .env manually
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      line = line.replace(/\r/g, ""); // Remove Windows carriage return
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
        process.env[key] = value;
      }
    });
    console.log("[Server] .env loaded");
  }
} catch (e) {
  console.error("[Server] Failed to load .env", e);
}

const PORT = 8000;

const server = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Helper to mimic Vercel response
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
    return res;
  };

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Route /api/xxx to api/xxx.js
  if (pathname.startsWith("/api/")) {
    let apiName = pathname.replace("/api/", "");
    
    // Handle nested routes like /api/auth/login -> api/auth.js
    // Keep the full path in req.url for the handler to parse
    const apiParts = apiName.split("/");
    const baseApiName = apiParts[0]; // e.g., "auth", "portfolio", "alerts"
    
    // Prevent directory traversal
    if (apiName.includes("..")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const modulePath = `./api/${baseApiName}.js`;

    try {
      console.log(`[Server] Request: ${req.method} ${pathname}`);
      const module = await import(modulePath);

      // Add query params to req
      req.query = parsedUrl.query;

      // Handle body for POST/PUT/DELETE requests
      if (["POST", "PUT", "DELETE"].includes(req.method)) {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", async () => {
          try {
            if (body) req.body = JSON.parse(body);
          } catch (e) {
            // Ignore JSON parse error, maybe body is empty or not JSON
          }
          try {
            await module.default(req, res);
          } catch (handlerErr) {
            console.error(`[Server] Handler Error ${pathname}:`, handlerErr);
            if (!res.writableEnded) {
              res.status(500).json({ error: handlerErr.message });
            }
          }
        });
      } else {
        try {
          await module.default(req, res);
        } catch (handlerErr) {
          console.error(`[Server] Handler Error ${pathname}:`, handlerErr);
          if (!res.writableEnded) {
            res.status(500).json({ error: handlerErr.message });
          }
        }
      }
    } catch (err) {
      console.error(`[Server] Error loading ${pathname}:`, err);
      res.status(404).json({ error: `API route not found: ${baseApiName}` });
    }
  } else {
    res.status(404).json({ error: "Not Found" });
  }
});

server.listen(PORT, () => {
  console.log(`Local API Server running at http://localhost:${PORT}`);
});

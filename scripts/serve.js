const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const port = process.argv[2] ? parseInt(process.argv[2].replace("--port=", "")) : 8000;
const host = process.argv[3] ? process.argv[3].replace("--host=", "") : "127.0.0.1";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown"
};

const server = http.createServer((req, res) => {
  let pathname = url.parse(req.url).pathname;
  
  // Default to demo.html for root
  if (pathname === "/") {
    pathname = "/demo.html";
  }
  
  const filePath = path.join(__dirname, "..", pathname);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "text/plain";
    
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});

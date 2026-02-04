// Cloud Run entrypoint placeholder.
// Typically exposes an HTTP endpoint that Cloud Scheduler hits to run ingestion jobs.
import http from "http";

const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "application/json"});
  res.end(JSON.stringify({ ok: true, service: "worker" }));
});

server.listen(process.env.PORT || 8080, () => {
  console.log("Worker listening");
});

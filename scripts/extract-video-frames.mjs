import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoPath = path.join(root, "assets", "website-idea.mp4");
const outputDir = path.join(root, "assets", "frames");
await fs.mkdir(outputDir, { recursive: true });

const server = http.createServer((request, response) => {
  if (request.url !== "/video.mp4") {
    response.writeHead(404);
    response.end();
    return;
  }

  const stat = fsSync.statSync(videoPath);
  const range = request.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : stat.size - 1;
    response.writeHead(206, {
      "Content-Type": "video/mp4",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes"
    });
    fsSync.createReadStream(videoPath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes"
  });
  fsSync.createReadStream(videoPath).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const videoUrl = `http://127.0.0.1:${port}/video.mp4`;

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "C:/Users/mures/.cache/puppeteer/chrome/win64-127.0.6533.88/chrome-win64/chrome.exe",
  args: ["--autoplay-policy=no-user-gesture-required", "--allow-file-access-from-files"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.setContent(`
  <video id="source" muted playsinline preload="auto" crossorigin="anonymous"></video>
  <canvas id="canvas" width="1440" height="900"></canvas>
  <script>
    const video = document.querySelector("#source");
    video.src = "${videoUrl}";
  </script>
`);

const duration = await page.evaluate(() => {
  const video = document.querySelector("#source");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out loading video metadata")), 15000);
    video.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`Video error ${video.error?.code || "unknown"}: ${video.error?.message || ""}`));
    }, { once: true });
    video.addEventListener("loadedmetadata", () => {
      clearTimeout(timer);
      resolve(video.duration);
    }, { once: true });
    video.load();
  });
});

const samples = [0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.98];
const frames = [];

for (let index = 0; index < samples.length; index += 1) {
  const time = Math.max(0.05, Math.min(duration - 0.05, duration * samples[index]));
  const dataUrl = await page.evaluate((targetTime) => {
    const video = document.querySelector("#source");
    const canvas = document.querySelector("#canvas");
    const ctx = canvas.getContext("2d");

    return new Promise((resolve) => {
      video.currentTime = targetTime;
      video.addEventListener("seeked", () => {
        const canvasRatio = canvas.width / canvas.height;
        const videoRatio = video.videoWidth / video.videoHeight;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoRatio > canvasRatio) {
          drawHeight = canvas.height;
          drawWidth = drawHeight * videoRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        } else {
          drawWidth = canvas.width;
          drawHeight = drawWidth / videoRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        }

        ctx.fillStyle = "#4b16c9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        resolve(canvas.toDataURL("image/png"));
      }, { once: true });
    });
  }, time);

  const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  const filename = `website-frame-${String(index + 1).padStart(2, "0")}.png`;
  await fs.writeFile(path.join(outputDir, filename), buffer);
  frames.push(filename);
}

console.log(JSON.stringify({ duration, frames }, null, 2));
await browser.close();
server.close();

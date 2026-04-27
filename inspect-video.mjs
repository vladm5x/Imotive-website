import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const videoPath = path.join(root, "reference.mp4").replaceAll("\\", "/");
const pagePath = `file:///${videoPath}`;

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--allow-file-access-from-files"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 1 });
await page.setContent(`
  <style>
    body { margin: 0; background: #111; display: grid; min-height: 100vh; place-items: center; }
    video { width: 100vw; height: 100vh; object-fit: contain; }
  </style>
  <video src="${pagePath}" muted playsinline></video>
`);
const duration = await page.$eval("video", (video) => new Promise((resolve) => {
  video.addEventListener("loadedmetadata", () => resolve(video.duration), { once: true });
}));

const moments = [0.1, duration * 0.25, duration * 0.5, duration * 0.75, Math.max(0.1, duration - 0.2)];
for (let index = 0; index < moments.length; index += 1) {
  await page.$eval("video", (video, time) => new Promise((resolve) => {
    video.currentTime = time;
    video.addEventListener("seeked", resolve, { once: true });
  }), moments[index]);
  await page.screenshot({ path: path.join(root, `reference-frame-${index + 1}.png`) });
}

console.log(JSON.stringify({ duration, frames: moments.map((time, index) => `reference-frame-${index + 1}.png`) }, null, 2));
await browser.close();

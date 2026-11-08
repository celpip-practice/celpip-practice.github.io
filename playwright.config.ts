import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 860 },
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
    },
    permissions: ["microphone"],
  },
  webServer: {
    // Serves the static export (run `npm run build` first).
    command: `.venv/bin/python -m http.server ${PORT} --bind 127.0.0.1 --directory out`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
  },
});

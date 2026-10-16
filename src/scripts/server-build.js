import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { repoRootDir } from "./utils.js";

// Copied into the Docker image (see Dockerfile).
const publishDir = path.join(repoRootDir, "src/server/bin/Release/publish");

// Publishing doesn't remove files of earlier builds, e.g. native libraries for other platforms.
fs.rmSync(publishDir, { recursive: true, force: true });

const result = spawnSync(
  "dotnet",
  [
    "publish",
    "src/server",
    "-c=Release",
    // The platform of the Docker image (Alpine on x64), so only its native libraries (e.g. of
    // SkiaSharp) are included instead of the ones for every platform.
    "-r=linux-musl-x64",
    "--self-contained=false",
    `-o=${publishDir}`,
  ],
  { cwd: repoRootDir, stdio: "inherit" }
);
process.exit(result.status ?? 1);

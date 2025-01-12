import { spawnSync } from "child_process";
import { argv } from "process";
import { repoRootDir } from "./utils.js";
import path from "path";

const name = argv[2];

if (!name) {
  console.error("No migration name provided");
  process.exit(1);
}

const buildResult = spawnSync("dotnet", ["build"], {
  cwd: path.resolve(repoRootDir, "src/server"),
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status);
}

spawnSync(
  "dotnet",
  [
    "ef",
    "migrations",
    "add",
    name,
    `--output-dir=Data/Migrations/Sqlite`,
    "--no-build",
    "--",
    "--database:skipmigration=true",
  ],
  { cwd: path.resolve(repoRootDir, "src/server"), stdio: "inherit" }
);

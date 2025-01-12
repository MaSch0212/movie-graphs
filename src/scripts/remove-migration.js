import { spawnSync } from "child_process";
import { repoRootDir } from "./utils.js";
import path from "path";

const buildResult = spawnSync("dotnet", ["build"], {
  cwd: path.resolve(repoRootDir, "src/server"),
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status);
}

spawnSync(
  "dotnet",
  ["ef", "migrations", "remove", "--no-build", "--force", "--", "--database:skipmigration=true"],
  { cwd: path.resolve(repoRootDir, "src/server"), stdio: "inherit" }
);

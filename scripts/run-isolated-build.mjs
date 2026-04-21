import { rmSync } from "node:fs";
import { spawn } from "node:child_process";

const isolatedDistDir = ".next-build";

rmSync(isolatedDistDir, { recursive: true, force: true });

const child =
  process.platform === "win32"
    ? spawn("cmd.exe", ["/c", "npm.cmd", "run", "build"], {
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_OUTPUT_DIR: isolatedDistDir,
        },
      })
    : spawn("npm", ["run", "build"], {
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_OUTPUT_DIR: isolatedDistDir,
        },
      });

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Isolated build failed to start:", error);
  process.exit(1);
});

import { join } from "https://deno.land/std@0.122.0/path/mod.ts";
import { serve } from "https://deno.land/std@0.132.0/http/server.ts";
import {
  serveDir,
  serveFile,
} from "https://deno.land/std@0.132.0/http/file_server.ts";

const projectPath = join(Deno.cwd(), "docs");
const distPath = join(projectPath, "dist");

serve((req) => {
  const pathname = new URL(req.url).pathname;
  if (pathname === "/") {
    return serveFile(req, join(distPath, "index.html"));
  } else {
    return serveDir(req, {
      fsRoot: distPath,
    });
  }
});

console.log("Running!");

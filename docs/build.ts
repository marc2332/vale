import { join } from "https://deno.land/std@0.122.0/path/mod.ts";
import build from "../vale.ts";

const projectPath = join(Deno.cwd(), "docs");

await build(projectPath);

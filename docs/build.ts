import build from "../vale.ts";

const projectPath = Deno.cwd();

await build(projectPath);

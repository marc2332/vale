import { join } from "https://deno.land/std@0.122.0/path/mod.ts";
import { ValeBuilder } from "../vale.ts";

const projectPath = join(Deno.cwd(), "docs");

const builder = await ValeBuilder.create(projectPath);
await builder.build();

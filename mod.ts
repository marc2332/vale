import { join } from "https://deno.land/std@0.122.0/path/mod.ts";
import { Command, CompletionsCommand, HelpCommand } from "./deps.ts";
import build from "./vale.ts";
import { serve } from "https://deno.land/std@0.132.0/http/server.ts";
import {
  serveDir,
  serveFile,
} from "https://deno.land/std@0.132.0/http/file_server.ts";

await new Command()
  .name("vale")
  .version("0.1.0")
  .global()
  .description(`Manage Vale projects`)
  .command("help", new HelpCommand().global())
  .command("completions", new CompletionsCommand())
  .command(
    "watch <dir:string> [optional]",
    "Run the documentation in development mode.",
  )
  .action(async (_, dir: string) => {
    const projectPath = join(Deno.cwd(), dir);
    const distPath = join(projectPath || "", "dist");

    const defaultRoute = await build(projectPath);

    serve((req) => {
      const pathname = new URL(req.url).pathname;
      if (pathname === "/") {
        return serveFile(req, defaultRoute);
      } else {
        return serveDir(req, {
          fsRoot: distPath,
        });
      }
    }, {
      port: 3500,
    });

    console.log("Development server running on http://localhost:3500/");

    const watcher = Deno.watchFs(projectPath);
    for await (const event of watcher) {
      if (event.paths.find((path) => path.startsWith(distPath))) {
        continue;
      }
      await build(projectPath);
    }
  })
  .command(
    "build <dir:string> [optional]",
    "Build the documentation.",
  )
  .action(async (_, dir: string) => {
    const projectPath = join(Deno.cwd(), dir);
    await build(projectPath);
    console.log("Built successfully");
  })
  .command(
    "init <title:string> [optional]",
    "Create a new project.",
  )
  .action(async (_, title: string) => {
    const projectPath = join(Deno.cwd(), title);
    const langPath = join(projectPath, "en");

    await Deno.mkdir(langPath, { recursive: true });

    await Deno.writeTextFile(
      join(projectPath, "metadata.json"),
      JSON.stringify({
        title,
        languages: [
          {
            name: "English",
            code: "en",
          },
        ],
      }),
    );

    await Deno.writeTextFile(
      join(langPath, "sidebar.json"),
      JSON.stringify({
        "1. Hello World": [],
      }),
    );

    const helloWorldCategoryPath = join(langPath, "hello_world");

    await Deno.mkdir(helloWorldCategoryPath);

    await Deno.writeTextFile(
      join(helloWorldCategoryPath, "__category.md"),
      `---
title: 1. Hello World
---

# 👋 Hello World

Thanks for using Vale :)! Please give it a [⭐ Star](https://github.com/marc2332/vale)
    
`,
    );

    console.log("Created successfully!");
    console.log(`To run use 'vale watch ${title}'`);
  })
  .parse(Deno.args);

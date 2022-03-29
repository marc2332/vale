import {
  Command,
  CompletionsCommand,
  extname,
  HelpCommand,
  join,
  serve,
  serveDir,
  serveFile,
} from "./deps.ts";
import { clearAssetsCache } from "./utils.ts";
import build from "./vale.ts";

const PORT = Deno.env.get("PORT") || 3500;

const serveCommand = (distPath: string) => {
  serve((req) => {
    const pathname = new URL(req.url).pathname;
    if (extname(pathname) == "") {
      return serveFile(req, join(distPath, pathname, "index.html"));
    } else {
      return serveDir(req, {
        fsRoot: distPath,
      });
    }
  }, {
    port: 3500,
  });
};

const buildCommand = (dir: string): [string, string] => {
  const projectPath = join(Deno.cwd(), dir);
  const distPath = join(projectPath || "", "dist");
  return [
    projectPath,
    distPath,
  ];
};

const initCommand = async (projectPath: string, title: string) => {
  const langPath = join(projectPath, "en");

  await Deno.mkdir(langPath, { recursive: true });

  await Deno.writeTextFile(
    join(projectPath, "metadata.json"),
    JSON.stringify({
      title,
      reference: "en",
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
};

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
  .option("-r, --reload [reload:boolean]", "Reload vale assets")
  .action(async ({ reload }, dir: string) => {
    if (reload) await clearAssetsCache();

    const [projectPath, distPath] = buildCommand(dir);
    await build(projectPath);

    serveCommand(distPath);

    console.log(`Development server running on  on http://localhost:${PORT}/`);

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
  .option("-r, --reload [reload:boolean]", "Reload vale assets")
  .action(async ({ reload }, dir: string) => {
    if (reload) await clearAssetsCache();

    const projectPath = join(Deno.cwd(), dir);
    await build(projectPath);
    console.log("Built successfully!");
  })
  .command(
    "init <title:string> [optional]",
    "Create a new project.",
  )
  .action(async (_, title: string) => {
    const projectPath = join(Deno.cwd(), title);

    await initCommand(projectPath, title);

    console.log("Created successfully!");
    console.log(`To run use 'vale watch ${title}'`);
  })
  .command(
    "serve <dir:string> [optional]",
    "Serve the documentation.",
  )
  .action((_, dir: string) => {
    const [_projectPath, distPath] = buildCommand(dir);

    serveCommand(distPath);

    console.log(`Serving documentation on http://localhost:${PORT}/`);
  })
  .parse(Deno.args);

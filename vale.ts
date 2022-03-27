import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import {
  basename,
  dirname,
  join,
  parse,
} from "https://deno.land/std@0.122.0/path/mod.ts";
import { cache } from "https://deno.land/x/cache@0.2.13/mod.ts";

interface CategoryData {
  name: string;
  doc: ContentDoc;
}

interface TreeFile {
  path: string;
  title: string;
  content?: string;
  entries?: Array<TreeFile>;
}

type Tree = Array<TreeFile | TreeFile>;

interface Metadata {
  title: string;
  languages: { code: string; name: string }[];
}

type Sidebar = { [key: string]: string[] };

interface DocEntry {
  content: string;
  path: string;
  title: string;
}

interface ContentDoc {
  entry: DocEntry;
  entries: DocEntry[];
}

interface ProcessResult {
  code: string;
  path: string;
  lastEntry: DocEntry | undefined;
}

const __dirname = dirname(import.meta.url);

// Cache the SVG menu icon
const svgMenuPath = join(__dirname, "menu.svg");
const svgMenuPathCached = (await cache(svgMenuPath)).path;
const svgMenu = await Deno.readTextFile(svgMenuPathCached);

const stylesPath = join(__dirname, "styles.css");
const stylesPathCached = (await cache(stylesPath)).path;

export default async function build(
  projectFolder: string,
): Promise<ProcessResult> {
  const folderMetadata: Metadata = JSON.parse(
    await Deno.readTextFile(join(projectFolder, "metadata.json")),
  );

  let result = {} as ProcessResult;

  // Create the dist folder
  const projectDist = join(projectFolder, "dist");
  await Deno.mkdir(projectDist, { recursive: true });

  // Copy styles.css
  const stylesDistPath = join(projectDist, "styles.css");
  await Deno.copyFile(stylesPathCached, stylesDistPath);

  const docsFolders = await Deno.readDir(projectFolder);

  for await (const langFolder of docsFolders) {
    // Ignore files and the dist folder
    if (langFolder.isFile || langFolder.name === "dist") continue;

    const categoryFolder = join(projectFolder, langFolder.name);

    // Get the sidebar configuration
    const sidebarConfig: Sidebar = JSON.parse(
      await Deno.readTextFile(join(categoryFolder, "sidebar.json")),
    );

    // Create the dist folder for the language
    const dist = join(projectDist, langFolder.name);
    await Deno.mkdir(dist, { recursive: true });

    const categoryEntries = Deno.readDir(categoryFolder);
    const tree: Tree = [];

    // Parse every category
    for await (const entry of categoryEntries) {
      if (entry.isDirectory) {
        const folderPath = join(categoryFolder, entry.name);
        const files = await lookInFolder(folderPath);
        const data = await getCategoryData(folderPath, files);
        tree.push(data);
      }
    }

    const docContents: Map<string, ContentDoc> = new Map();

    for (const treeCategory of tree) {
      if (treeCategory.entries != null) {
        const categoryEntry = getDocEntry(treeCategory, treeCategory);

        docContents.set(treeCategory.title, {
          entry: categoryEntry,
          entries: [],
        });

        const contentCategory = docContents.get(treeCategory.title);

        for (const treeFile of treeCategory.entries) {
          if (treeFile.entries == null) {
            const fileEntry = getDocEntry(treeFile, treeCategory);

            contentCategory?.entries.push(fileEntry);
          }
        }
      }
    }

    const orderedContent = orderSidebarCategories(sidebarConfig, docContents);

    let lastEntry: DocEntry | undefined;
    let categoryIndex = 0;

    for (const { doc } of orderedContent) {
      const prevCategoryDoc = orderedContent[categoryIndex - 1];
      const nextCategoryDoc = orderedContent[categoryIndex + 1];

      const processResult = await processCategory(
        folderMetadata,
        langFolder.name,
        dist,
        doc,
        orderedContent,
        lastEntry || prevCategoryDoc?.doc?.entry,
        nextCategoryDoc?.doc?.entry,
      );

      lastEntry = processResult.lastEntry;

      if (categoryIndex === 0) {
        result = processResult;
      }

      categoryIndex++;
    }
  }

  const indexFilePath = join(projectDist, `index.html`);
  await Deno.writeTextFile(indexFilePath, result.code);

  return result;
}

async function getDocsFromFile(filePath: string): Promise<TreeFile> {
  const content = await Deno.readTextFile(filePath);
  const markup = Marked.parse(content);
  return {
    path: basename(filePath),
    title: markup.meta.title,
    content: markup.content,
  };
}

async function lookInFolder(folder: string): Promise<Array<TreeFile>> {
  const entries = Deno.readDir(folder);
  const treeFiles = [];
  for await (const entry of entries) {
    if (entry.isFile) {
      const treeFile = await getDocsFromFile(join(folder, entry.name));
      treeFiles.push(treeFile);
    }
  }
  return treeFiles;
}

async function getCategoryData(
  folderPath: string,
  entries: Array<TreeFile>,
): Promise<TreeFile> {
  const dataFilePath = join(folderPath, "__category.md");
  try {
    const treeFile = await getDocsFromFile(dataFilePath);
    return {
      ...treeFile,
      path: basename(folderPath),
      entries,
    };
  } catch {
    return {
      title: basename(folderPath),
      path: basename(folderPath),
      entries,
    };
  }
}

function orderSidebarCategories(
  sidebarConfig: Sidebar,
  docContents: Map<string, ContentDoc>,
): CategoryData[] {
  return Object.entries(sidebarConfig).map(([name, entries]) => {
    const doc = docContents.get(name);
    if (doc != null) {
      // Order the entries by the sidebar or der
      doc.entries = entries.map((entryTitle) => {
        return doc.entries.find((en) =>
          en.title === entryTitle || en.title === name
        );
      }).filter(Boolean) as DocEntry[];

      return {
        name,
        doc,
      };
    } else {
      throw Error(`Category '${name}' is not found`);
    }
  });
}

function sidebarToHTML(
  langCode: string,
  categories: CategoryData[],
  entryActiveTitle: string,
): string {
  const links = categories.map(
    ({ name, doc: { entry: categoryEntry, entries } }) => {
      const isCategoryActive = entryActiveTitle == categoryEntry.title;
      const categoryClass = isCategoryActive ? "active" : "";

      const categoryEntries = entries.map((entry) => {
        const isNotCategoryDoc = categoryEntry.path !== entry.path;
        const isActive = entryActiveTitle == entry.title;
        const entryClass = isActive ? "active" : "";

        return isNotCategoryDoc &&
          `<li><a class="${entryClass}" href="/${langCode}/${entry.path}.html">${entry.title}</a></li>`;
      }).filter(Boolean).join("");

      return `
        <div>
            <a class="${categoryClass}" href="/${langCode}/${categoryEntry.path}.html"><b>${name}</b></a>
            <div>
                <ul>
                    ${categoryEntries}
                </ul>
            </div>
        </div>
      `;
    },
  ).join("");

  return `
    <div id="sidebar">
      ${links}
    </div>
  `;
}

function getDocEntry(treeFile: TreeFile, categoryTree: TreeFile): DocEntry {
  return {
    content: treeFile.content || "",
    path: `${categoryTree.path}/${treeFile.path}`,
    title: treeFile.title,
  };
}

function docToHTML(
  folderMetadata: Metadata,
  langCode: string,
  entry: DocEntry,
  orderedContent: CategoryData[],
  prevEntry?: DocEntry,
  nextEntry?: DocEntry,
): string {
  const sidebarHTML = sidebarToHTML(langCode, orderedContent, entry.title);

  const languages = folderMetadata.languages.map((language) => {
    return `<option value="${language.code}" ${
      language.code === langCode ? "selected" : ""
    } >${language.name}</option>`;
  });

  const prevButton = prevEntry
    ? `<a class="prev" href="/${langCode}/${prevEntry.path}.html"><button> ← ${prevEntry.title}</button></a>`
    : "";

  const nextButton = nextEntry
    ? `<a class="next" href="/${langCode}/${nextEntry.path}.html"><button> ${nextEntry.title} →</button></a>`
    : "";

  return `
        <html>
            <head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="stylesheet" href="/styles.css"></link>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/github.min.css"></link> 
                <title>${entry.title} | ${folderMetadata.title}</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/highlight.min.js"></script>
            </head>
            <body>
                <div id="navbar">
                    <div>
                        <h4>${folderMetadata.title}</h4>
                        <select id="language" onchange="languageChanged()">${languages}</select>
                    </div>
                    <button onclick="toggleSideBar()">
                        ${svgMenu}
                    </button>
                </div>
                <div id="content">
                    ${sidebarHTML}
                    <main>
                        <div>
                            ${entry.content}
                            <div id="navigators">
                                ${prevButton}
                                ${nextButton}
                            </div>
                        </div>
                    </main>
                </div>
                <script>
                    const sidebar = document.getElementById("sidebar");
                    function toggleSideBar(){
                        const isShown = sidebar.style.display === "block";
                        sidebar.style.display = isShown ? "none" : "block";
                    }
                    window.addEventListener("resize", () => {
                        if(document.body.clientWidth > 650){
                            sidebar.style.display = "block";
                        }else {
                            sidebar.style = "";
                        }
                    })
                    hljs.initHighlightingOnLoad();
                    function languageChanged(){
                        const newLang = document.getElementById("language").value;
                        location.pathname = '/' + newLang + location.pathname.slice(3)
                    }
                </script>
            </body>
        </html>
    `;
}

async function processCategory(
  folderMetadata: Metadata,
  langCode: string,
  dist: string,
  { entry: categoryEntry, entries }: ContentDoc,
  orderedContent: CategoryData[],
  prevCategoryEntry?: DocEntry,
  nextCategoryEntry?: DocEntry,
): Promise<ProcessResult> {
  // Use the the next category as next page
  let nextCategoryEntryConfig = nextCategoryEntry;

  // Save last entry for the next categories
  let lastEntry: DocEntry | undefined;

  const folderPath = join(dist, dirname(categoryEntry.path));
  await Deno.mkdir(folderPath, { recursive: true });

  await Promise.all(entries.map(async (fileEntry, fileIndex) => {
    const prevEntry = entries[fileIndex - 1] || categoryEntry;
    const nextEntry = entries[fileIndex + 1] || nextCategoryEntry;

    const code = docToHTML(
      folderMetadata,
      langCode,
      fileEntry,
      orderedContent,
      prevEntry,
      nextEntry,
    );
    const filePath = `${fileEntry.path}.html`;
    await Deno.writeTextFile(join(dist, filePath), code);

    if (fileIndex === 0) {
      // Use the first category entry as the next page for the category
      nextCategoryEntryConfig = fileEntry;
    }
    if (fileIndex == entries.length - 1) {
      lastEntry = fileEntry;
    }
  }));

  const code = docToHTML(
    folderMetadata,
    langCode,
    categoryEntry,
    orderedContent,
    prevCategoryEntry,
    nextCategoryEntryConfig,
  );
  const filePath = join(dist, `${categoryEntry.path}.html`);
  await Deno.writeTextFile(filePath, code);
  return {
    code,
    path: filePath,
    lastEntry,
  };
}

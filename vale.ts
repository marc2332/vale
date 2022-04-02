import { basename, dirname, join, Marked, parse } from "./deps.ts";
import { getCachedAssets } from "./utils.ts";
import {
  CategoryData,
  ContentDoc,
  DocEntry,
  Metadata,
  ProcessResult,
  Sidebar,
  Tree,
  TreeFile,
  ValeData,
} from "./types.ts";

export class ValeBuilder {
  static async create(projectRoot: string): Promise<Vale> {
    const metadata: Metadata = JSON.parse(
      await Deno.readTextFile(join(projectRoot, "metadata.json")),
    );

    const assets = await getCachedAssets();

    return new Vale({
      projectRoot,
      metadata,
      assets,
    });
  }
}

export class Vale {
  private projectDist: string;

  constructor(private valeData: ValeData) {
    this.projectDist = join(this.valeData.projectRoot, "dist");
  }

  private async setupDist() {
    // Create the dist folder
    await Deno.mkdir(this.projectDist, { recursive: true });

    // Copy styles.css
    const stylesDistPath = join(this.projectDist, "styles.css");
    await Deno.copyFile(this.valeData.assets.stylesPathCached, stylesDistPath);
  }

  /**
   * Try to find and parse a `sidebar.json` inside the folder specified in `languageFolder`
   */
  private async getSidebarConfigForLanguage(
    languageFolder: string,
  ): Promise<Sidebar | null> {
    try {
      return JSON.parse(
        await Deno.readTextFile(join(languageFolder, "sidebar.json")),
      );
    } catch {
      return null;
    }
  }

  public async build() {
    await this.setupDist();

    const result: ProcessResult[] = [];

    const docsFolders = await Deno.readDir(this.valeData.projectRoot);

    // The content reference to look up to
    let referenceContent: CategoryData[] = [];

    let langIndex = 0;

    // Iterate over all the languages
    for await (const langEntry of docsFolders) {
      // Ignore files and the dist folder
      if (langEntry.isFile || langEntry.name === "dist") continue;

      const languageFolder = join(this.valeData.projectRoot, langEntry.name);

      // Create dist folder for the language
      const langDist = join(this.projectDist, langEntry.name);
      await Deno.mkdir(langDist, { recursive: true });

      // Get the sidebar configuration

      const sidebarConfig = await this.getSidebarConfigForLanguage(
        languageFolder,
      );
      // Ignore this folder if it doesn't contain a sidebar config file
      if (sidebarConfig == null) continue;

      // Read all the categories in this language folder
      const categoryEntries = Deno.readDir(languageFolder);

      const contentTree: Tree = [];

      // Read every category and their entries
      for await (const entry of categoryEntries) {
        if (entry.isDirectory) {
          const folderPath = join(languageFolder, entry.name);
          const files = await lookInFolder(folderPath);
          const data = await getCategoryData(folderPath, files);
          contentTree.push(data);
        }
      }

      // Parse all these categories and entries
      const docContents: Map<string, ContentDoc> = new Map();

      for (const category of contentTree) {
        if (category.entries != null) {
          const categoryEntry = getDocEntry(category, category);

          docContents.set(category.title, {
            entry: categoryEntry,
            entries: new Map(),
          });

          const contentCategory = docContents.get(category.title);

          for (const treeFile of category.entries) {
            if (treeFile.entries == null) {
              const fileEntry = getDocEntry(treeFile, category);

              contentCategory?.entries.set(fileEntry.path, fileEntry);
            }
          }
        }
      }

      const orderedContent = orderSidebarCategories(sidebarConfig, docContents);
      const finalOrderedContent = mergeContentWithReferenceContent(
        referenceContent,
        orderedContent,
      );

      // Mark this language content as the reference
      if (langEntry.name === this.valeData.metadata.reference) {
        referenceContent = orderedContent;
      }

      let lastEntry: DocEntry | undefined;
      let categoryIndex = 0;

      for (const { doc } of finalOrderedContent) {
        const prevCategoryDoc = finalOrderedContent[categoryIndex - 1];
        const nextCategoryDoc = finalOrderedContent[categoryIndex + 1];

        const processResult = await this.processCategory(
          langEntry.name,
          langDist,
          doc,
          finalOrderedContent,
          lastEntry || prevCategoryDoc?.doc?.entry,
          nextCategoryDoc?.doc?.entry,
        );
        lastEntry = processResult.lastEntry;
        if (categoryIndex === 0) {
          result.push(processResult);
        }
        categoryIndex++;
      }

      // Create a index.html file for every language containing the same content as the first category in the language
      const indexFilePath = join(langDist, `index.html`);
      await Deno.writeTextFile(indexFilePath, result[langIndex].htmlCode);

      langIndex++;
    }

    // Create a index.html file for the website containing the same content as the first category in the first language
    const indexFilePath = join(this.projectDist, `index.html`);
    await Deno.writeTextFile(indexFilePath, result[0].htmlCode);
  }

  /**
   * Creates the final files of the specified category in categoryEntry
   */
  private async processCategory(
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

    const categoryDist = join(dist, dirname(categoryEntry.path));
    await Deno.mkdir(categoryDist, { recursive: true });

    await Promise.all(
      Array.from(entries).map(
        async ([_title, fileEntry], fileIndex, listEntries) => {
          const [_prevTitle, prevEntry] = listEntries[fileIndex - 1] || [
            null,
            categoryEntry,
          ];
          const [_nextTitle, nextEntry] = listEntries[fileIndex + 1] || [
            null,
            nextCategoryEntry,
          ];

          const htmlCode = this.contentToHTML(
            langCode,
            fileEntry,
            orderedContent,
            prevEntry,
            nextEntry,
          );
          const filePath = `${fileEntry.path}.html`;
          await Deno.writeTextFile(join(dist, filePath), htmlCode);

          if (fileIndex === 0) {
            // Use the first category entry as the next page for the category
            nextCategoryEntryConfig = fileEntry;
          }
          if (fileIndex == listEntries.length - 1) {
            lastEntry = fileEntry;
          }
        },
      ),
    );

    const htmlCode = this.contentToHTML(
      langCode,
      categoryEntry,
      orderedContent,
      prevCategoryEntry,
      nextCategoryEntryConfig,
    );
    const filePath = join(dist, `${categoryEntry.path}.html`);
    await Deno.writeTextFile(filePath, htmlCode);
    return {
      htmlCode,
      path: filePath,
      lastEntry,
    };
  }

  /**
   * Creates a HTML Document for the specified content in `entry`
   */
  private contentToHTML(
    langCode: string,
    entry: DocEntry,
    orderedContent: CategoryData[],
    prevEntry?: DocEntry,
    nextEntry?: DocEntry,
  ): string {
    const sidebarHTML = sidebarToHTML(langCode, orderedContent, entry.title);

    // Create the dropdown, default option is this language specified in `langCode`
    const languages = this.valeData.metadata.languages.map((language) => {
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
                  <link id="hightlight-light" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/github.min.css"></link>
                  <link id="hightlight-dark"rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/github-dark.min.css"></link>
                  <title>${entry.title} | ${this.valeData.metadata.title}</title>
                  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/highlight.min.js"></script>
              </head>
              <body>
                  <div id="navbar">
                      <div>
                          <h4>${this.valeData.metadata.title}</h4>
                          <select id="language" onchange="languageChanged()">${languages}</select>
                          <button id="theme-toggler" onclick="toggleTheme()">${this.valeData.assets.sunSvg}</button>
                      </div>
                      <button id="sidebar-toggler" onclick="toggleSideBar()">
                          ${this.valeData.assets.svgMenu}
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
                      const themeToggler = document.getElementById("theme-toggler");
                      const isDarkMode = localStorage.getItem("valeTheme") === "true";

                      loadTheme(isDarkMode);

                      function updateToggler(isDarkMode){
                        if(isDarkMode) {
                          themeToggler.innerHTML = \`${this.valeData.assets.moonSvg}\`;
                          document.getElementById("hightlight-light").setAttribute("disabled", "disabled");
                          document.getElementById("hightlight-dark").removeAttribute("disabled");
                        }
                        else{
                          themeToggler.innerHTML = \`${this.valeData.assets.sunSvg}\`;
                          document.getElementById("hightlight-dark").setAttribute("disabled", "disabled");
                          document.getElementById("hightlight-light").removeAttribute("disabled");
                        }
                      }

                      function loadTheme(isDarkMode){
                        updateToggler(isDarkMode)
                        if(isDarkMode) {
                          document.body.classList.toggle("dark-theme");
                        } else{
                          document.body.classList.remove("dark-theme");
                        }
                      }

                      function toggleTheme(){
                        const isDarkMode = localStorage.getItem("valeTheme") === "true";
                        loadTheme(!isDarkMode)
                        localStorage.setItem("valeTheme", !isDarkMode);
                      }

                      const sidebar = document.getElementById("sidebar-menu");

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
}

function mergeContentWithReferenceContent(
  referenceContent: CategoryData[],
  content: CategoryData[],
): CategoryData[] {
  if (referenceContent.length == 0) return content;
  const mergedContent = [...referenceContent];
  content.forEach((category, i) => {
    category.doc.entries.forEach((entry) => {
      mergedContent[i].doc.entries.set(entry.path, entry);
    });
    mergedContent[i].doc.entry = category.doc.entry;
  });
  return mergedContent;
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
    if (entry.isFile && entry.name != "__category.md") {
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
      const filteredEntries = new Map();
      entries.forEach((entryTitle) => {
        const res = doc.entries.get(entryTitle);
        if (res != null) {
          filteredEntries.set(entryTitle, res);
        }
      });

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
  const links = categories
    .map(({ name, doc: { entry: categoryEntry, entries } }) => {
      const isCategoryActive = entryActiveTitle == categoryEntry.title;
      const categoryClass = isCategoryActive ? "active" : "";
      const categoryEntries = Array.from(entries)
        .map(([_, entry]) => {
          const isNotCategoryDoc = categoryEntry.path !== entry.path;
          const isActive = entryActiveTitle == entry.title;
          const entryClass = isActive ? "active" : "";
          return (
            isNotCategoryDoc &&
            `<li><a class="${entryClass}" href="/${langCode}/${entry.path}.html">${entry.title}</a></li>`
          );
        })
        .filter(Boolean)
        .join("");
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
    })
    .join("");
  return `
    <div id="sidebar-menu">
      ${links}
    </div>
  `;
}

function getDocEntry(treeFile: TreeFile, categoryTree: TreeFile): DocEntry {
  return {
    content: treeFile.content || "",
    path: `${categoryTree.path}/${parse(treeFile.path).name}`,
    title: treeFile.title,
  };
}

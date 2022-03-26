import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import { basename, dirname, fromFileUrl, join } from "https://deno.land/std@0.122.0/path/mod.ts";

const rootFolder = Deno.args[0];

interface TreeFile {
    title: string,
    content?: string,
    entries?: Array<TreeFile>
}

type Tree = Array<TreeFile | TreeFile>


async function getDocsFromFile(filePath: string) : Promise<TreeFile> {
    const content = await Deno.readTextFile(filePath);
    const markup = Marked.parse(content);
    return {
        title: markup.meta.title,
        content: markup.content
    }
}



async function lookInFolder(folder: string): Promise<Array<TreeFile>> {
    const entries = Deno.readDir(folder);
    const treeFiles = []
    for await (const entry of entries){
        
        if(entry.isFile){
            const treeFile = await getDocsFromFile(join(folder, entry.name));
            treeFiles.push(treeFile)
        }
    }
    return treeFiles;
}

async function getCategoryData(folderPath: string, entries: Array<TreeFile>): Promise<TreeFile> {
    const dataFilePath = join(folderPath, "__category.md");
    try {
        const treeFile = await getDocsFromFile(dataFilePath);
        return {
            ...treeFile,
            entries
        }
    } catch {
        return {
            title: basename(folderPath),
            entries
        }
    } 
}

interface Metadata {
    title: string
}

const folderMetadata: Metadata = JSON.parse(await Deno.readTextFile(join(Deno.cwd(), rootFolder, "metadata.json")));
console.log(folderMetadata)
const folderEntries = Deno.readDir(rootFolder);
const tree: Tree = []

for await (const entry of folderEntries){
    if(entry.isDirectory){
        const folderPath = join(rootFolder, entry.name);
        const files = await lookInFolder(folderPath);
        const data = await getCategoryData(folderPath, files);
        tree.push(data);
    }
}

function sidebarToHTML(sidebar: Map<string, ContentDoc>, entryActiveTitle: string): string {

    let code = '';
    sidebar.forEach(({ entry: categoryEntry, entries }, category) => {
        const categoryID = join(categoryEntry.path, categoryEntry.path)
        const isCategoryActive = entryActiveTitle == categoryEntry.title;
        code += `
            <div>
                <a class="${isCategoryActive ? "active" : ""}" href="/${categoryID}.html"><b>${category}</b></a>
                <div>
                   <ul>
                    ${entries.map(entry => {
                        const isNotCategoryDoc = categoryEntry.path !== entry.path;
                        const linkID = join(categoryEntry.path, entry.path);
                        const isActive = entryActiveTitle == entry.title;

                        return isNotCategoryDoc && `<li><a class="${isActive ? "active" : ""}" href="/${linkID}.html">${entry.title}</a></li>`  
                    }).filter(Boolean).join("")}
                   </ul>
                </div>
            </div>
        `
    });

    return `
        <div id="sidebar">
            ${code}
        </div>
    `
}

function getDocEntry(treeFile: TreeFile): DocEntry {
    return {
        content: treeFile.content || "",
        path: `${treeFile.title.replace(/\s/g,"")}`,
        title: treeFile.title
    }
}

interface DocEntry {
    content: string,
    path: string,
    title: string
}

interface ContentDoc { 
    entry: DocEntry, 
    entries: DocEntry[]
}

const content: Map<string, ContentDoc> = new Map();

for (const treeCategory of tree){
    if(treeCategory.entries != null){

        const categoryEntry = getDocEntry(treeCategory);

        content.set(treeCategory.title, {
            entry: categoryEntry,
            entries: []
        });

        const contentCategory = content.get(treeCategory.title);        

        for (const treeFile of treeCategory.entries){
            if(treeFile.entries == null){

                const fileEntry = getDocEntry(treeFile);

                contentCategory?.entries.push(fileEntry);
            }
        }
    }
}






function docToHTML(entry: DocEntry): string {

    const sidebarHTML = sidebarToHTML(content, entry.title);

    return `
        <html>
            <head>
                <meta charset="UTF-8">
                <link rel="stylesheet" href="/styles.css"></link>
                <title>${entry.title} | ${folderMetadata.title}</title>
            </head>
            <body>
                ${sidebarHTML}
                <main>
                    <div>
                        ${entry.content}
                    </div>
                </main
            </body>
        </html>
    `
}

const dist = join(Deno.cwd(), "dist")

content.forEach( async({ entry, entries }) => {
    const folderPath = join(dist, entry.path);
    await Deno.mkdir(folderPath, { recursive: true });

    await Promise.all(entries.map( async(entry) => {
        const code = docToHTML(entry);
        const filePath = `${join(folderPath, entry.path)}.html`;
        await Deno.writeTextFile(filePath, code);
    }));
}) 

const __dirname = dirname(fromFileUrl(import.meta.url));
const stylesPath = join(__dirname, "styles.css");
const stylesDistPath = join(dist, "styles.css");

await Deno.copyFile(stylesPath, stylesDistPath);
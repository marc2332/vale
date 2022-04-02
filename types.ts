export interface CategoryData {
  name: string;
  doc: ContentDoc;
}

export interface TreeFile {
  path: string;
  title: string;
  content?: string;
  entries?: Array<TreeFile>;
}

export type Tree = Array<TreeFile | TreeFile>;

export interface Metadata {
  title: string;
  reference: string;
  languages: { code: string; name: string }[];
}

export type Sidebar = { [key: string]: string[] };

export interface DocEntry {
  content: string;
  path: string;
  title: string;
}

export interface ContentDoc {
  entry: DocEntry;
  entries: Map<string, DocEntry>;
}

export interface ProcessResult {
  htmlCode: string;
  path: string;
  lastEntry: DocEntry | undefined;
}

export interface ValeData {
  projectRoot: string;
  metadata: Metadata;
  assets: CachedAssets;
}

export interface CachedAssets {
  svgMenu: string;
  sunSvg: string;
  moonSvg: string;
  stylesPathCached: string;
}

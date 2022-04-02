import { dirname, join } from "https://deno.land/std@0.122.0/path/mod.ts";
import { namespace } from "https://deno.land/x/cache@0.2.13/mod.ts";
import { CachedAssets } from "./types.ts";

const __dirname = dirname(import.meta.url);

const valeNamespace = namespace("vale");

export const getCachedAssets = async (): Promise<CachedAssets> => {
  // Cache the SVG files
  const svgMenuPath = join(__dirname, "assets", "menu.svg");
  const svgMenuPathCached = (await valeNamespace.cache(svgMenuPath)).path;
  const svgMenu = await Deno.readTextFile(svgMenuPathCached);

  const sunSvgPath = join(__dirname, "assets", "sun.svg");
  const sunSvgPathCached = (await valeNamespace.cache(sunSvgPath)).path;
  const sunSvg = await Deno.readTextFile(sunSvgPathCached);

  const moonSvgPath = join(__dirname, "assets", "moon.svg");
  const moonSvgPathCached = (await valeNamespace.cache(moonSvgPath)).path;
  const moonSvg = await Deno.readTextFile(moonSvgPathCached);

  const stylesPath = join(__dirname, "styles.css");
  const stylesPathCached = (await valeNamespace.cache(stylesPath)).path;

  return {
    svgMenu,
    sunSvg,
    moonSvg,
    stylesPathCached,
  };
};
export const clearAssetsCache = () => {
  return valeNamespace.purge();
};

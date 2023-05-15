import path from "node:path";
import { readFile } from "node:fs/promises";
import { env, cwd } from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { emojify } from "node-emoji";
import browserslist from "browserslist";
import { JSDOM } from "jsdom";
import { getConfig, formatCSP } from "react-csp/lib/utils.js";
import svgrPlugin from "esbuild-plugin-svgr";
import NodeModulesPolyfills from "@esbuild-plugins/node-modules-polyfill";
import GlobalsPolyfills from "@esbuild-plugins/node-globals-polyfill";
import { resolveToEsbuildTarget } from "esbuild-plugin-browserslist";

export const log = (text) => console.info(emojify(text));

export const __dirname = path.join(cwd(), "./build");
log(`:wrench: Build folder path: ${chalk.blue(__dirname)}`);

const __thisdir = path.dirname(fileURLToPath(import.meta.url));

export const __public = path.normalize(path.join(__dirname, "../public"));
log(`:wrench: Public files path: ${chalk.blue(__public)}`);

export const isDev = env.NODE_ENV !== "production";
log(
    `:wrench: Current mode: ${chalk.blue(isDev ? "development" : "production")}`
);

// Read package.json for configuration
const packageJson = JSON.parse(
    await readFile(path.join(__dirname, "../package.json"))
);

const siteRoot = packageJson?.homepage ?? "/";
log(`:wrench: Site root: ${chalk.blue(siteRoot)}`);

const browsersQuery = isDev
    ? packageJson?.browserslist?.development ?? [
          "last 1 chrome version",
          "last 1 firefox version",
          "last 1 safari version",
      ]
    : packageJson?.browserslist?.production ?? ["defaults"];

const externalFiles =
    (isDev
        ? packageJson?.externalFiles?.development
        : packageJson?.externalFiles?.production) ?? [];

const target = [
    ...new Set(
        resolveToEsbuildTarget(browserslist(browsersQuery), {
            printUnknownTargets: false,
        })
    ),
].sort();
log(`:wrench: Bundle target: ${chalk.blue(target)}`);

const entryPoints = packageJson?.build?.entrypoints ?? [
    path.join(__dirname, "../src/index.tsx"),
];
log(`:wrench: Entrypoints: ${entryPoints.join(",")}`);

// Base config for esbuild
export const commonEsBuildConfig = {
    incremental: true,
    metafile: true,
    sourcemap: isDev,
    bundle: true,
    minify: !isDev,
    treeShaking: true,
    mainFields: ["browser", "module", "main"],
    target,
    publicPath: siteRoot,
    legalComments: "linked",

    entryPoints,
    assetNames: "assets/[name]-[hash]",
    chunkNames: "chunks/[name]-[hash]",

    nodePaths: [path.join(__dirname, "../node_modules")],

    external: externalFiles,
    drop: isDev ? [] : ["debugger"],

    // Makes React work without imports
    inject: [path.join(__thisdir, "react-shim.js")],

    plugins: [
        // Makes importing .svg files work
        svgrPlugin({
            namedExport: "ReactComponent",
            exportType: "named",
        }),
        // Provides polyfills for some packages that still import node-specific packages
        NodeModulesPolyfills.default(),
        GlobalsPolyfills.default({
            process: true,
            define: {
                "process.env.NODE_ENV": `"${
                    process.env.NODE_ENV ?? "development"
                }"`,
            },
            buffer: true,
        }),
    ],
    loader: {
        ".woff": "file",
        ".woff2": "file",
        ".png": "file",
    },
};

export async function prepareHtml(generatedFiles) {
    let html = await readFile(
        path.join(__dirname, "../public/index.html"),
        "utf8"
    );

    // Fill out %PUBLIC_URL% to preserve compat with react-scripts
    const urlPrefix = siteRoot.replace(/\/$/, "");
    html = html.replaceAll("%PUBLIC_URL%", urlPrefix);

    const dom = new JSDOM(html);
    const document = dom.window.document;

    const resourcesToInclude = generatedFiles.filter(
        (f) => !(f.startsWith("/assets") || f.startsWith("/chunks"))
    );

    const scriptsToInclude = resourcesToInclude.filter(
        (f) => path.extname(f) === ".js"
    );
    for (const script of scriptsToInclude) {
        const scriptEl = document.createElement("script");
        scriptEl.setAttribute("src", `${urlPrefix}${script}`);
        document.body.appendChild(scriptEl);
    }

    const stylesToInclude = resourcesToInclude.filter(
        (f) => path.extname(f) === ".css"
    );
    for (const style of stylesToInclude) {
        const linkEl = document.createElement("link");
        linkEl.setAttribute("rel", "stylesheet");
        linkEl.setAttribute("href", `${urlPrefix}${style}`);
        document.body.appendChild(linkEl);
    }

    // Inject CSP tag
    if (!isDev) {
        log(":lock: Adding CSP policy tag");
        const cspTag = formatCSP(await getConfig());

        // Inject the csp tag into a template element to convert string to Node
        const template = document.createElement("template");
        template.innerHTML = cspTag;

        document.head.appendChild(template.content.firstChild);
    }

    return dom.serialize();
}

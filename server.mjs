#!/usr/bin/env node
import http from "node:http";
import { join, basename } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { context } from "esbuild";
import { copy } from "fs-extra";
import { __public, __dirname, prepareHtml, commonEsBuildConfig, log } from "./common.mjs";

log(":chart_with_upwards_trend: Generating index.html...");
const index = await prepareHtml(["/index.js", "/index.css"]);
log(":white_check_mark: Done generating index.html...");

log(":rocket: Starting esbuild devserver");

const servedir = join(__dirname, "serve");
if (existsSync(servedir)) {
    log(":file_folder: Serve directory already exists, cleaning up...");
    await rm(servedir, { recursive: true, force: true });
}

log(":chart_with_upwards_trend: Copying files from public/ folder");
for (const file of readdirSync(__public)) {
    if (file === "index.html") {
        // index.html is generated by script
        continue;
    }

    await copy(join(__public, file), join(servedir, basename(file)));
}

log(":white_check_mark: Done copying files");


const esbuildContext = await context({
    ...commonEsBuildConfig,
    assetNames: "assets/[name]",
    chunkNames: "chunks/[name]",
    entryNames: "[name]",
    outdir: servedir
});

const { host, port } = await esbuildContext.serve({
    servedir: servedir,
});

log(":rocket: Starting proxy to serve index.html");
const proxy = http.createServer((req, res) => {
    const options = {
        hostname: host,
        port: port,
        path: req.url,
        method: req.method,
        headers: req.headers,
    };

    // Forward each incoming request to esbuild
    const proxyReq = http.request(options, (proxyRes) => {
        // If esbuild returns "not found", send index.html
        if (proxyRes.statusCode === 404 || req.url === "/") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(index);
            return;
        }

        // Otherwise, forward the response from esbuild to the client
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    // Forward the body of the request to esbuild
    req.pipe(proxyReq, { end: true });
});

proxy.listen(3000);
log(":white_check_mark: Dev server is available on port 3000");

process.on("SIGINT", () => {
    log(":wave: Detected SIGINIT, exiting. Bye!");
    esbuildContext.cancel();
    proxy.close();
});

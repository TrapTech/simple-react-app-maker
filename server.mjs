#!/usr/bin/env node
import http from "node:http";
import { serve } from "esbuild";
import { __public, prepareHtml, commonEsBuildConfig, log } from "./common.mjs";

log(":chart_with_upwards_trend: Generating index.html...");
const index = await prepareHtml(["/index.js", "/index.css"]);
log(":white_check_mark: Done generating index.html...");

log(":rocket: Starting esbuild devserver");

const { host, port, stop } = await serve(
    {
        servedir: __public,
    },
    {
        ...commonEsBuildConfig,
    },
);

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
    stop();
    proxy.close();
});

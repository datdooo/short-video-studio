// Extracted route bodies retain their original order and response contracts.
export function createStorageRoutes({ mediaLibrary, readJson, sendJson, serveMediaPath }) {
  return [
    {
      order: 28,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/storage"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/storage") {
          sendJson(request, response, 200, { library: await mediaLibrary.list() });
          return;
        }
        return false;
      },
    },
    {
      order: 29,
      condition: '["GET", "HEAD"].includes(request.method || "") && storageMediaMatch',
      matchers: "const storageMediaMatch = requestUrl.pathname.match(/^\\/api\\/storage\\/media\\/([^/]+)$/);",
      async handle(request, response, requestUrl) {
        const storageMediaMatch = requestUrl.pathname.match(/^\/api\/storage\/media\/([^/]+)$/);
        if (["GET", "HEAD"].includes(request.method || "") && storageMediaMatch) {
          const target = await mediaLibrary.media(decodeURIComponent(storageMediaMatch[1]));
          await serveMediaPath(request, response, target, {
            download: requestUrl.searchParams.get("download") === "1",
          });
          return;
        }
        return false;
      },
    },
    {
      order: 30,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/storage/trash"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/storage/trash") {
          const body = await readJson(request);
          sendJson(request, response, 200, await mediaLibrary.move(body.id));
          return;
        }
        return false;
      },
    },
    {
      order: 31,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/storage/restore"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/storage/restore") {
          const body = await readJson(request);
          sendJson(request, response, 200, await mediaLibrary.restore(body.id));
          return;
        }
        return false;
      },
    },
    {
      order: 32,
      condition: 'request.method === "DELETE" && requestUrl.pathname === "/api/storage/trash"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "DELETE" && requestUrl.pathname === "/api/storage/trash") {
          const body = await readJson(request);
          sendJson(request, response, 200, await mediaLibrary.purge(body.ids));
          return;
        }
        return false;
      },
    },
  ];
}

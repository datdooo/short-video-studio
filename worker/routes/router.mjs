// A route returns false only when it did not match. A handled response may
// return undefined (including streaming), exactly as the former server branch.
export function createRouter(routes) {
  const ordered = [...routes].sort((a, b) => a.order - b.order);
  if (new Set(ordered.map((r) => r.order)).size !== ordered.length) throw Error("Duplicate route order");
  return async (request, response, url) => {
    for (const route of ordered) if ((await route.handle(request, response, url)) !== false) return true;
    return false;
  };
}
export function routeTable(routes) {
  return [...routes]
    .sort((a, b) => a.order - b.order)
    .map(({ order, condition, matchers }) => ({ order, condition, matchers }));
}

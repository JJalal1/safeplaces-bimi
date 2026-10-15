export default {
  async fetch(request, env) {
    if (!env.STAGING) return new Response("Staging backend unavailable", { status: 503 });
    const url = new URL(request.url);
    // The service binding routes to the private staging worker, not to workers.dev.
    const backend = new Request(url.toString(), request);
    return env.STAGING.fetch(backend);
  }
};

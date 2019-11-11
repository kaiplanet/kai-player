import "network-idle-callback/lib/request-monitor";

import CacheService from "./CacheService";

const initialize = (self: ServiceWorkerGlobalScope): void => {
    const cacheService = new CacheService();
    const cacheServiceInitPromise = cacheService.init();

    self.addEventListener("install", async (event) => {
        event.waitUntil(cacheServiceInitPromise);
    });

    self.addEventListener("activate", async (event) => {
        event.waitUntil(Promise.all([cacheServiceInitPromise, cacheService.checkVersion()]));
    });

    self.addEventListener("fetch", (event) => {
        // @ts-ignore
        self.requestMonitor.listen(event);

        event.respondWith((async () => {
            try {
                const response = await cacheService.match(event.request);

                if (response) {
                    return response;
                }

                const networkResponse = await fetch(event.request);

                // @ts-ignore
                self.requestMonitor.unlisten(event);

                if (event.request.method === "POST") {
                    return networkResponse;
                }

                try {
                    if (!networkResponse.ok) {
                        return networkResponse;
                    }
                } catch (e) {
                    // console.log(e);
                }

                cacheService.put(event.request, networkResponse.clone());

                return networkResponse;
            } catch (e) {
                // @ts-ignore
                self.requestMonitor.unlisten(event);

                throw e;
            }
        })());
    });
};

initialize(self as any);

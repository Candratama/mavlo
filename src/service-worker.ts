/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `mavlo-${version}`;
const ASSETS = [...build, ...files];
const OFFLINE_FALLBACK = '/sign-in';

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
		})()
	);
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const cached = await cache.match(request);
				return cached ?? fetch(request);
			})
		);
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const fresh = await fetch(request);
					const cache = await caches.open(CACHE);
					cache.put(request, fresh.clone()).catch(() => undefined);
					return fresh;
				} catch {
					const cache = await caches.open(CACHE);
					const cached = await cache.match(request);
					return cached ?? (await cache.match(OFFLINE_FALLBACK)) ?? Response.error();
				}
			})()
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(request);
			const fetched = fetch(request)
				.then((response) => {
					if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
					return response;
				})
				.catch(() => null);
			return cached ?? (await fetched) ?? Response.error();
		})()
	);
});

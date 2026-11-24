async function capiGet(config, path) {
  const response = await fetch(`${config.capiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.capiApiKey}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === false) {
    const msg = payload.message || `HTTP ${response.status}`;
    throw new Error(`Capibara API error en ${path}: ${msg}`);
  }

  return payload;
}

/**
 * Obtiene todas las obras públicas del scan paginando GET /works.
 */
export async function fetchAllPublicWorks(config) {
  const works = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await capiGet(config, `/works?limit=50&page=${page}`);
    const items = Array.isArray(res.data) ? res.data : [];
    for (const work of items) {
      if (work.isPublic) {
        works.push(work);
      }
    }
    totalPages = res.pagination?.pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return works;
}

/**
 * Obtiene los capítulos publicados más recientes de una obra específica.
 */
export async function fetchPublishedChaptersForWork(config, work, limit = 10) {
  const res = await capiGet(config, `/works/${work.id}/chapters?limit=${limit}&order=desc`);
  const items = Array.isArray(res.data) ? res.data : [];

  return items
    .filter((ch) => ch.state === 'published')
    .map((ch) => ({
      id: String(ch.id),
      workId: String(work.id),
      mangaTitle: work.title,
      alternativeTitle: work.alternativeTitle || '',
      chapterNumber: ch.displayNumber ?? ch.number ?? '',
      chapterTitle: ch.title || '',
      volumeNumber: ch.volumeNumber ?? null,
      announcePage: ch.announcePage ?? null,
      extra: Boolean(ch.extra),
      isOneShot: Boolean(work.isOneShot),
      pages: ch.pages ?? 0,
      chapterUrl: ch.url,
      mangaUrl: work.url,
      coverUrl: work.coverUrl || work.coverThumbUrl || '',
      bannerUrl: work.bannerUrl || '',
      releasedAt: ch.releasedAt || ch.createdAt || work.lastChapterAt || null,
    }));
}

/**
 * Obtiene la imagen del capítulo para el anuncio:
 * - Si el capítulo tiene `announcePage` marcada, usa esa página.
 * - Si no tiene página marcada, usa la página 4 (donde comienza el capítulo).
 * - Si el capítulo tiene menos de 4 páginas, usa la página 2 (o la 1 / portada si solo tiene 1 página).
 */
export async function resolveAnnouncementImageUrl(config, chapter, defaultPage = 4) {
  const targetPage = Number(chapter.announcePage) > 0 ? Number(chapter.announcePage) : defaultPage;

  try {
    const res = await capiGet(config, `/chapters/${chapter.id}/pages`);
    const pages = Array.isArray(res.data?.pages) ? res.data.pages : [];
    if (pages.length === 0) {
      return chapter.coverUrl || null;
    }

    const pickPage = (num) => pages.find((p) => Number(p.number) === num) || pages[num - 1];

    const exact = pickPage(targetPage);
    if (exact?.imageUrl) return exact.imageUrl;

    // Si tiene menos de 4 páginas, usamos la página 2 (o la primera si solo tiene 1)
    const secondPage = pickPage(2);
    if (secondPage?.imageUrl) return secondPage.imageUrl;

    return pages[0]?.imageUrl || chapter.coverUrl || null;
  } catch (err) {
    console.warn(`Aviso: no se pudieron leer las páginas del cap ${chapter.id} (${err.message}). Usando portada.`);
    return chapter.coverUrl || null;
  }
}

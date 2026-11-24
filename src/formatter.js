/**
 * Formato oficial de Worms Organization / SenshiManga para Facebook.
 * - Usa el link del perfil del manga (`chapter.mangaUrl`).
 * - Usa la página marcada en `announcePage` o la página 4 del capítulo (`chapter.announcementImageUrl`).
 */
export function formatPost(chapter) {
  const titleUpper = chapter.mangaTitle.toUpperCase();
  const header = chapter.chapterNumber !== '' && chapter.chapterNumber !== null
    ? `[${titleUpper}] CAPÍTULO ${chapter.chapterNumber}`
    : `[${titleUpper}]`;

  const link = chapter.mangaUrl || chapter.chapterUrl;

  const message = [
    header,
    link,
    'Si les gustó el cap no se olviden de seguir la pagina y dejar su like, además de reaccionar a la publicación que eso ayuda de mucho, sin nada más que decir nos vemos.',
    'Link de nuestro [PATREON]: https://www.patreon.com/WormsOrganization',
    'Link del [DISCORD]: https://discord.gg/5h5QzZg7QY',
    'LINK DEL [PAYPAL]: https://paypal.me/wormsorganization',
    'Link del [KO-FI]: https://ko-fi.com/wormsorg',
  ].filter(Boolean).join('\n');

  return {
    message,
    imageUrl: chapter.announcementImageUrl || chapter.coverUrl || null,
    link,
    firstComment: null,
  };
}

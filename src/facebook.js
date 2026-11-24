async function graphPost(url, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      body.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const metaMsg = data.error?.message || `HTTP ${response.status}`;
    const metaCode = data.error?.code ? ` (código ${data.error.code})` : '';
    throw new Error(`Meta Graph API error${metaCode}: ${metaMsg}`);
  }

  return data;
}

/**
 * Publica un anuncio en la Página de Facebook.
 * - Si hay `imageUrl`, usa /{page-id}/photos (sube la imagen con `caption`).
 * - Si no hay `imageUrl`, usa /{page-id}/feed (publicación de texto/enlace).
 * - Si hay `firstComment`, agrega el primer comentario al post recién creado.
 */
export async function publishToFacebook(config, post) {
  const baseUrl = `https://graph.facebook.com/${config.fbGraphVersion}`;
  let postId;

  if (post.imageUrl) {
    const result = await graphPost(`${baseUrl}/${config.fbPageId}/photos`, {
      url: post.imageUrl,
      caption: post.message,
      published: 'true',
      access_token: config.fbPageAccessToken,
    });
    postId = result.post_id || result.id;
  } else {
    const result = await graphPost(`${baseUrl}/${config.fbPageId}/feed`, {
      message: post.message,
      link: post.link || undefined,
      access_token: config.fbPageAccessToken,
    });
    postId = result.id;
  }

  let commentId = null;
  if (post.firstComment && postId) {
    try {
      const commentResult = await graphPost(`${baseUrl}/${postId}/comments`, {
        message: post.firstComment,
        access_token: config.fbPageAccessToken,
      });
      commentId = commentResult.id || null;
    } catch (err) {
      console.warn(`Aviso: el post ${postId} sí se publicó, pero falló el primer comentario: ${err.message}`);
    }
  }

  return { postId, commentId };
}

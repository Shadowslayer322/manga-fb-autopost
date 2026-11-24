export function loadConfig(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const seedOnly = argv.includes('--seed') || process.env.SEED_ONLY === 'true';

  const cleanSecret = (val, prefix) =>
    (val || '')
      .replace(new RegExp(`^${prefix}=`, 'i'), '')
      .replace(/^["']|["']$/g, '')
      .replace(/\s+/g, '');

  const config = {
    capiBaseUrl: (process.env.CAPI_BASE_URL || 'https://capibaratraductor.com/api/v1').replace(/\/+$/, ''),
    capiApiKey: cleanSecret(process.env.CAPI_API_KEY || process.env.MANGA_API_KEY, 'CAPI_API_KEY'),
    fbPageId: cleanSecret(process.env.FB_PAGE_ID, 'FB_PAGE_ID'),
    fbPageAccessToken: cleanSecret(process.env.FB_PAGE_ACCESS_TOKEN, 'FB_PAGE_ACCESS_TOKEN'),
    fbGraphVersion: (process.env.FB_GRAPH_VERSION || 'v21.0').trim(),
    maxPostsPerRun: Math.max(1, Number.parseInt(process.env.MAX_POSTS_PER_RUN || '20', 10) || 20),
    dryRun,
    seedOnly,
  };

  if (!config.capiApiKey) {
    throw new Error('Falta la variable de entorno CAPI_API_KEY.');
  }

  if (!config.dryRun && !config.seedOnly) {
    if (!config.fbPageId) {
      throw new Error('Falta la variable de entorno FB_PAGE_ID.');
    }
    if (!config.fbPageAccessToken) {
      throw new Error('Falta la variable de entorno FB_PAGE_ACCESS_TOKEN.');
    }
  }

  return config;
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import {
  fetchAllPublicWorks,
  fetchPublishedChaptersForWork,
  resolveAnnouncementImageUrl,
} from './api.js';
import { formatPost } from './formatter.js';
import { publishToFacebook } from './facebook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '../state/published.json');
const MAX_STORED_IDS = 3000;

async function loadState() {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      workLastChapterAt: parsed.workLastChapterAt && typeof parsed.workLastChapterAt === 'object'
        ? { ...parsed.workLastChapterAt }
        : {},
      publishedIds: new Set(Array.isArray(parsed.publishedIds) ? parsed.publishedIds.map(String) : []),
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { workLastChapterAt: {}, publishedIds: new Set() };
    }
    throw err;
  }
}

async function saveState(state) {
  const payload = {
    workLastChapterAt: state.workLastChapterAt,
    publishedIds: Array.from(state.publishedIds).slice(-MAX_STORED_IDS),
  };
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sortByDateDesc(a, b) {
  return new Date(b || 0).getTime() - new Date(a || 0).getTime();
}

async function main() {
  const config = loadConfig();
  const state = await loadState();

  console.log(`Consultando obras públicas en: ${config.capiBaseUrl}`);
  const works = await fetchAllPublicWorks(config);
  console.log(`Obras públicas encontradas: ${works.length}`);

  // Modo SEED: registra todas las obras y los últimos capítulos sin publicar nada en Facebook.
  if (config.seedOnly) {
    for (const work of works) {
      if (work.lastChapterAt) {
        state.workLastChapterAt[String(work.id)] = work.lastChapterAt;
      }
    }
    // También registramos los últimos capítulos de las 10 obras más recientes por seguridad
    const recentWorks = [...works]
      .filter((w) => w.lastChapterAt)
      .sort((a, b) => sortByDateDesc(a.lastChapterAt, b.lastChapterAt))
      .slice(0, 10);

    for (const work of recentWorks) {
      const chapters = await fetchPublishedChaptersForWork(config, work, 10);
      for (const ch of chapters) {
        state.publishedIds.add(ch.id);
      }
    }

    await saveState(state);
    console.log(`Modo SEED listo: ${works.length} obras y ${state.publishedIds.size} capítulos registrados sin publicar.`);
    return;
  }

  const isFirstRun = Object.keys(state.workLastChapterAt).length === 0;

  // Detectamos solo las obras cuyo lastChapterAt es más reciente que el guardado
  let updatedWorks = works.filter((work) => {
    if (!work.lastChapterAt) return false;
    const prev = state.workLastChapterAt[String(work.id)];
    if (!prev) return true;
    return new Date(work.lastChapterAt).getTime() > new Date(prev).getTime();
  });

  // Si es la primera ejecución sin haber hecho --seed, limitamos a las 3 obras más recientes para evitar spam masivo
  if (isFirstRun && updatedWorks.length > 3) {
    console.log('Aviso: estado vacío (no se corrió --seed). Revisando solo las 3 obras más recientes.');
    updatedWorks = [...updatedWorks]
      .sort((a, b) => sortByDateDesc(a.lastChapterAt, b.lastChapterAt))
      .slice(0, 3);
  }

  if (updatedWorks.length === 0) {
    console.log('No hay obras con capítulos nuevos.');
    return;
  }

  console.log(`Obras con actividad nueva: ${updatedWorks.length}`);

  const candidateChapters = [];
  for (const work of updatedWorks) {
    const prevTimestamp = state.workLastChapterAt[String(work.id)]
      ? new Date(state.workLastChapterAt[String(work.id)]).getTime()
      : 0;

    const chapters = await fetchPublishedChaptersForWork(config, work, 10);
    for (const ch of chapters) {
      if (state.publishedIds.has(ch.id)) continue;
      // Si ya teníamos registro de esta obra, ignoramos capítulos viejos anteriores al último timestamp conocido
      if (prevTimestamp && ch.releasedAt && new Date(ch.releasedAt).getTime() <= prevTimestamp) {
        continue;
      }
      candidateChapters.push(ch);
    }
  }

  // Orden cronológico (del más antiguo al más reciente)
  candidateChapters.sort((a, b) => new Date(a.releasedAt || 0).getTime() - new Date(b.releasedAt || 0).getTime());

  if (candidateChapters.length === 0) {
    // Actualizamos timestamps de obras aunque no haya capítulos nuevos publicables
    if (!config.dryRun) {
      for (const work of updatedWorks) {
        state.workLastChapterAt[String(work.id)] = work.lastChapterAt;
      }
      await saveState(state);
    }
    console.log('No hay capítulos nuevos publicados para anunciar.');
    return;
  }

  const toPublish = candidateChapters.slice(0, config.maxPostsPerRun);
  const hasRemaining = candidateChapters.length > toPublish.length;
  console.log(`Capítulos nuevos a procesar en esta corrida: ${toPublish.length} (de ${candidateChapters.length} pendientes)`);

  let publishedCount = 0;

  for (let i = 0; i < toPublish.length; i += 1) {
    const chapter = toPublish[i];
    chapter.announcementImageUrl = await resolveAnnouncementImageUrl(config, chapter, 4);
    const post = formatPost(chapter);

    if (config.dryRun) {
      console.log('\n--- [DRY RUN] Publicación simulada ---');
      console.log(`ID: ${chapter.id} | Obra: ${chapter.mangaTitle} | Cap: ${chapter.chapterNumber}`);
      console.log('Imagen:', post.imageUrl || '(sin imagen)');
      console.log('Mensaje:\n' + post.message);
      if (post.firstComment) console.log('Primer comentario:', post.firstComment);
      continue;
    }

    const { postId, commentId } = await publishToFacebook(config, post);
    console.log(`Publicado capítulo ${chapter.id} (${chapter.mangaTitle} #${chapter.chapterNumber}) -> post_id=${postId}${commentId ? `, comment_id=${commentId}` : ''}`);

    state.publishedIds.add(chapter.id);
    if (chapter.releasedAt) {
      const currentSaved = state.workLastChapterAt[chapter.workId];
      if (!currentSaved || new Date(chapter.releasedAt).getTime() > new Date(currentSaved).getTime()) {
        state.workLastChapterAt[chapter.workId] = chapter.releasedAt;
      }
    }
    publishedCount += 1;
    await saveState(state);

    // Pausa breve entre posts para evitar límites de velocidad de Meta
    if (i < toPublish.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!config.dryRun) {
    // Solo avanzamos el timestamp global de las obras si ya no quedaron capítulos pendientes en cola
    if (!hasRemaining) {
      for (const work of updatedWorks) {
        if (work.lastChapterAt) {
          state.workLastChapterAt[String(work.id)] = work.lastChapterAt;
        }
      }
      await saveState(state);
    }
    console.log(`Listo. Se publicaron ${publishedCount} capítulos nuevos.`);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});

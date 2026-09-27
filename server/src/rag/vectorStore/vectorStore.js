import { ragConfig } from '../config/ragConfig.js';

import { logger } from '../../observability/logger.js';

import {
  incrementMetric,
  observeDuration
} from '../../observability/metrics.js';

import { setQdrantHealth } from '../../observability/health.js';

const CORPUS = 'aman-portfolio';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createVectorStore({
  url = process.env.VECTOR_DB_URL,
  apiKey = process.env.VECTOR_DB_API_KEY,
  collection = ragConfig.collection,
  dimensions = ragConfig.embeddingDimensions,
  distance = ragConfig.vectorDistance,
  fetchImpl = fetch,
  retries = 2
} = {}) {
  let collectionReady = false;

  const endpoint = path => {
    if (!url) {
      throw Object.assign(
        new Error('Vector database is not configured.'),
        {
          code: 'VECTOR_DB_NOT_CONFIGURED'
        }
      );
    }

    return `${url.replace(/\/$/, '')}${path}`;
  };

  async function request(
    path,
    {
      method = 'GET',
      body,
      signal
    } = {}
  ) {
    if (!url) {
      throw Object.assign(
        new Error('Vector database is not configured.'),
        {
          code: 'VECTOR_DB_NOT_CONFIGURED'
        }
      );
    }

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const requestSignal = signal
          ? AbortSignal.any([
              signal,
              AbortSignal.timeout(8000)
            ])
          : AbortSignal.timeout(8000);

        const response = await fetchImpl(
          endpoint(path),
          {
            method,
            headers: {
              'content-type': 'application/json',
              ...(apiKey
                ? { 'api-key': apiKey }
                : {})
            },
            ...(body
              ? { body: JSON.stringify(body) }
              : {}),
            signal: requestSignal
          }
        );

        if (response.ok) {
          return response.status === 204
            ? {}
            : response.json();
        }

        if (response.status === 404) {
          return {
            __notFound: true
          };
        }

        const error = new Error(
          `Vector database returned HTTP ${response.status}.`
        );

        error.status = response.status;

        if (
          response.status < 500 &&
          response.status !== 429
        ) {
          throw Object.assign(error, {
            retryable: false
          });
        }

        throw error;
      } catch (error) {
        if (
          signal?.aborted ||
          error.name === 'AbortError'
        ) {
          throw Object.assign(
            new Error(
              'Vector database request cancelled.'
            ),
            {
              code: 'CANCELLED',
              cause: error
            }
          );
        }

        if (
          error.retryable === false ||
          error.status === 401 ||
          error.status === 403
        ) {
          throw error;
        }

        lastError = error;

        if (attempt < retries) {
          await delay(
            200 * (2 ** attempt)
          );
        }
      }
    }

    throw Object.assign(
      new Error(
        'Vector database request failed.'
      ),
      {
        code: 'VECTOR_DB_REQUEST_FAILED',
        cause: lastError
      }
    );
  }

  async function ensureCollection(signal) {
    if (collectionReady) return;

    const name = encodeURIComponent(collection);

    const existing = await request(
      `/collections/${name}`,
      {
        signal
      }
    );

    if (existing.__notFound) {
      const created = await request(
        `/collections/${name}`,
        {
          method: 'PUT',
          body: {
            vectors: {
              size: dimensions,
              distance
            }
          },
          signal
        }
      );

      if (created.__notFound) {
        throw new Error(
          'Vector database collection creation failed.'
        );
      }
    } else {
      const vectors =
        existing.result?.config?.params?.vectors;

      const actual =
        vectors &&
        typeof vectors.size === 'number'
          ? vectors
          : null;

      if (
        !actual ||
        actual.size !== dimensions ||
        actual.distance !== distance
      ) {
        logger.error(
          'qdrant.collection.incompatible',
          {
            collection,
            expectedDimensions: dimensions,
            actualDimensions:
              actual?.size ?? null,
            expectedDistance: distance,
            actualDistance:
              actual?.distance ?? null
          }
        );

        throw Object.assign(
          new Error(
            `Qdrant collection ${collection} configuration is incompatible (expected ${dimensions}/${distance}; received ${actual?.size ?? 'unknown'}/${actual?.distance ?? 'unknown'}).`
          ),
          {
            code: 'VECTOR_COLLECTION_INCOMPATIBLE'
          }
        );
      }
    }

    collectionReady = true;
  }

  async function upsert(chunks, vectors) {
    if (
      !Array.isArray(chunks) ||
      !Array.isArray(vectors) ||
      chunks.length !== vectors.length
    ) {
      throw new Error(
        'Vector upsert input is invalid.'
      );
    }

    await ensureCollection();

    if (!chunks.length) return;

    await request(
      `/collections/${encodeURIComponent(collection)}/points?wait=true`,
      {
        method: 'PUT',
        body: {
          points: chunks.map(
            (chunk, index) => ({
              id: chunk.vectorId,
              vector: vectors[index],
              payload: {
                corpus: CORPUS,
                chunkId: chunk.id,
                documentId: chunk.documentId,
                type: chunk.type,
                title: chunk.title,
                slug: chunk.slug,
                category: chunk.category,
                source: chunk.source,
                content: chunk.content
              }
            })
          )
        }
      }
    );
  }

  async function listCorpusPointIds() {
    await ensureCollection();

    const ids = [];
    let offset;

    do {
      const page = await request(
        `/collections/${encodeURIComponent(collection)}/points/scroll`,
        {
          method: 'POST',
          body: {
            limit: 256,
            with_payload: false,
            with_vector: false,
            ...(offset
              ? { offset }
              : {}),
            filter: {
              must: [
                {
                  key: 'corpus',
                  match: {
                    value: CORPUS
                  }
                }
              ]
            }
          }
        }
      );

      if (page.__notFound) {
        throw new Error(
          'Vector database scroll endpoint was not found.'
        );
      }

      for (
        const point of page.result?.points || []
      ) {
        ids.push(point.id);
      }

      offset =
        page.result?.next_page_offset ||
        undefined;
    } while (offset);

    return ids;
  }

  async function deleteIds(ids) {
    if (ids.length) {
      await request(
        `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
        {
          method: 'POST',
          body: {
            points: ids
          }
        }
      );
    }
  }

  async function searchRaw(
    vector,
    {
      limit = ragConfig.topK,
      type,
      signal
    } = {}
  ) {
    await ensureCollection(signal);

    const must = [
      {
        key: 'corpus',
        match: {
          value: CORPUS
        }
      }
    ];

    // Project-aware retrieval.
    // When retrieveDocuments.js detects a project query,
    // it passes type = "project".
    if (type) {
      must.push({
        key: 'type',
        match: {
          value: type
        }
      });
    }

    const result = await request(
      `/collections/${encodeURIComponent(collection)}/points/query`,
      {
        method: 'POST',
        body: {
          query: vector,
          limit,
          with_payload: true,
          with_vector: false,
          score_threshold:
            ragConfig.similarityThreshold,
          filter: {
            must
          }
        },
        signal
      }
    );

    if (result.__notFound) {
      throw new Error(
        'Vector database query endpoint was not found.'
      );
    }

    return (
      result.result?.points || []
    )
      .map(point => ({
        score: point.score,
        id: point.payload?.chunkId,
        documentId:
          point.payload?.documentId,
        type: point.payload?.type,
        title: point.payload?.title,
        slug: point.payload?.slug,
        category:
          point.payload?.category,
        source:
          point.payload?.source,
        content:
          point.payload?.content
      }))
      .filter(
        point =>
          typeof point.content === 'string' &&
          Number.isFinite(point.score)
      );
  }

  async function search(
    vector,
    options = {}
  ) {
    const started = performance.now();

    logger.info(
      'qdrant.search.started',
      {
        limit:
          options.limit ||
          ragConfig.topK,
        type: options.type || null
      }
    );

    try {
      const matches =
        await searchRaw(
          vector,
          options
        );

      setQdrantHealth('available');

      incrementMetric(
        'qdrant.searches'
      );

      observeDuration(
        'qdrant.search',
        performance.now() - started
      );

      logger.info(
        'qdrant.search.completed',
        {
          durationMs:
            Math.round(
              performance.now() -
                started
            ),
          resultCount:
            matches.length,
          type:
            options.type || null
        }
      );

      return matches;
    } catch (error) {
      if (error.code === 'CANCELLED') {
        throw error;
      }

      setQdrantHealth(
        'unavailable'
      );

      incrementMetric(
        'qdrant.errors'
      );

      observeDuration(
        'qdrant.search',
        performance.now() - started
      );

      logger.warn(
        'qdrant.search.failed',
        {
          durationMs:
            Math.round(
              performance.now() -
                started
            ),
          errorCategory:
            error.code ||
            (error.status
              ? `HTTP_${error.status}`
              : error.name ||
                'QDRANT_ERROR'),
          type:
            options.type || null
        }
      );

      throw error;
    }
  }

  return Object.freeze({
    ensureCollection,
    upsert,
    search,
    listCorpusPointIds,
    deleteIds
  });
}
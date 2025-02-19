import type { CollectionReference } from '@google-cloud/firestore';
import type { Context, Middleware, SessionStore } from 'telegraf';

interface Options<C> {
  getSessionKey: (ctx: C) => string | undefined;
  lazy:
    | boolean
    | Promise<boolean>
    | ((ctx: C) => boolean)
    | ((ctx: C) => Promise<boolean>);
}

export function middleware<C extends Context>(
  collection: CollectionReference,
  opts?: Partial<Options<C>>,
): Middleware<C> {
  const DEFAULT_OPTIONS: Options<C> = {
    getSessionKey: (ctx: C) =>
      ctx.from && ctx.chat && `${ctx.from.id}-${ctx.chat.id}`,
    lazy: () => false,
  };
  const completeOpts: Options<C> = { ...DEFAULT_OPTIONS, ...opts };

  const options = {
    getSessionKey: completeOpts.getSessionKey,
    lazy: async (ctx: C) =>
      typeof completeOpts.lazy === 'function'
        ? completeOpts.lazy(ctx)
        : completeOpts.lazy,
  };

  async function getSession(key: string) {
    const snapshot = await collection.doc(key).get();
    // Assume we can cast document to session data
    return snapshot.data() as C | undefined;
  }

  async function saveSession(key: string, session: C | {} | undefined) {
    if (session == null || Object.keys(session).length === 0) {
      return collection.doc(key).delete();
    }
    const _saved = await collection.doc(key).set(session);
    console.timeEnd('session.middleware');
    return _saved;
  }

  return async (ctx, next) => {
    console.time('session.middleware');
    const key = options.getSessionKey(ctx);
    if (key === undefined) {
      return next?.();
    }
    // determine if we should wrap the session data into a promise
    const immediate = !(await options.lazy(ctx));

    let session: C | {} | undefined;
    let sessionP: Promise<C | {}> | undefined;

    if (immediate) session = (await getSession(key)) || {};

    Object.defineProperty(ctx, 'session', {
      get() {
        // returns either session or sessionP, depending on laziness
        if (immediate) {
          return session;
        } else {
          if (sessionP === undefined)
            // eslint-disable-next-line no-async-promise-executor
            sessionP = new Promise(async (resolve) => {
              if (session === undefined)
                session = (await getSession(key)) || {};
              resolve(session);
            });
          return sessionP;
        }
      },
      set(newValue) {
        session = Object.assign({}, newValue);
      },
    });

    const n = await next?.();

    if (immediate) return saveSession(key, session);
    else if (sessionP !== undefined) return saveSession(key, await sessionP);
    else {
      console.timeEnd('session.middleware');
      return n;
    }
  };
}

interface FirestoreOpts {
  collection: CollectionReference;
}

export function Firestore<Session>(opts: FirestoreOpts): SessionStore<Session> {
  const { collection } = opts;

  return {
    async get(key: string) {
      const snapshot = await collection.doc(key).get();
      if (!snapshot.exists) return undefined;

      const data = snapshot.data();

      return data as Session;
    },
    async set(key: string, value) {
      return collection.doc(key).set(value);
    },
    async delete(key: string) {
      return collection.doc(key).delete();
    },
  };
}

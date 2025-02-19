// import { session } from 'telegraf';
// import { middleware } from './session.firestore.middleware';

import { Redis } from '@telegraf/session/redis';
// export const sessionMiddleware = (firebaseInstance) =>
//   middleware(firebaseInstance.getFirestore().collection('sessions'));

export const store = Redis({
  url: 'redis://127.0.0.1:6379',
});

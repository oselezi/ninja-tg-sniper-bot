import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';

export const axios = setupCache(Axios, {
  ttl: 3600 * 1000, // 60 minutes
});

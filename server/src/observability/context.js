import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
export const getLogContext = () => storage.getStore() || {};
export const withLogContext = (context, callback) => storage.run(context, callback);

let state = 'unavailable';
export const setRedisState = value => { state = value; };
export const getRedisHealth = () => state;

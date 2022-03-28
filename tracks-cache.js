const tracksCache = new Map();

export const getFromCache = async (key) => {
  return tracksCache.get(key);
};

export const addToCache = async (key, value) => {
  return tracksCache.set(key, value);
};

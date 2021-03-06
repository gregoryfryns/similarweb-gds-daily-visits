/**
 * Constructor for DataCache.
 * More info on caching: https://developers.google.com/apps-script/reference/cache/cache
 *
 * @param {object} cacheService - GDS caching service
 * @param {String} url - API endpoint URL
 * @param {object} params - API parameters
 *
 * @return {object} DataCache.
 */
function DataCache(cacheService, url, params) {
  this.service = cacheService;
  this.cacheKey = this.buildCacheKey(url, params);

  return this;
}

/** @const - 6 hours, Google's max */
DataCache.REQUEST_CACHING_TIME = 21600;

/** @const - 100 KB */
DataCache.MAX_CACHE_SIZE = 100 * 1024;

/**
 * Builds a cache key for given GDS request
 *
 * @return {String} cache key
 */
DataCache.prototype.buildCacheKey = function(url, params) {
  var par = JSON.parse(JSON.stringify(params));
  delete par['api_key'];
  delete par['format'];
  delete par['show_verified'];

  var parString = Object.keys(par).sort().map(function(x) {return x + '=' + par[x];}).join('&');

  // TODO: make sure the key doesn't exceed 245 (= 250 - 5) characters (https://developers.google.com/apps-script/reference/cache/cache)
  return url.replace(/^https:\/\/api\.similarweb\.com\/.*\/website\/xxx\//, '') + '?' + parString;
};

/**
 * Gets stored value
 *
 * @return {String} Response string
 */
DataCache.prototype.get = function() {
  var value = '';
  var chunk = '';
  var chunkIndex = 0;

  do {
    var chunkKey = this.getChunkKey(chunkIndex);
    chunk = this.service.get(chunkKey);
    value += (chunk || '');
    chunkIndex++;
  } while (chunk && chunk.length == DataCache.MAX_CACHE_SIZE);

  return value;
};

/**
 * Stores value in cache.
 *
 * @param {String} value
 */
DataCache.prototype.set = function(value) {
  this.storeChunks(value);
};

DataCache.prototype.storeChunks = function(value) {
  var chunks = this.splitInChunks(value);

  for (var i = 0; i < chunks.length; i++) {
    var chunkKey = this.getChunkKey(i);
    this.service.put(chunkKey, chunks[i], DataCache.REQUEST_CACHING_TIME);
  }
};

DataCache.prototype.getChunkKey = function(chunkIndex) {
  return this.cacheKey + '_' + chunkIndex;
};

DataCache.prototype.splitInChunks = function(str) {
  var size = DataCache.MAX_CACHE_SIZE;
  var numChunks = Math.ceil(str.length / size);
  var chunks = new Array(numChunks);

  for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }

  return chunks;
};

/* global exports */
if (typeof(exports) !== 'undefined') {
  exports['__esModule'] = true;
  exports['default'] = DataCache;
}

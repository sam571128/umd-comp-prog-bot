const fetch = require('node-fetch');
const cache = require('./cache');

const ATCODER_BASE_URL = 'https://atcoder.jp';

const ATCODER_CACHE_TTL = 60 * 60 * 1000;

/**
 * Get user information from AtCoder
 * @param {string} username - AtCoder username
 * @returns {Promise<Object>} - User information
 */
async function getAtCoderUser(username) {
  try {
    const cacheKey = `atcoder:user:${username}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const userData = {
      username: username,
      rating: null,
      rank: null,
      maxRating: null,
      contests: 0,
      lastUpdated: new Date()
    };
    
    await cache.set(cacheKey, userData, ATCODER_CACHE_TTL);
    
    return userData;
  } catch (error) {
    console.error('Error fetching AtCoder user:', error);
    throw error;
  }
}

/**
 * Get AtCoder contest list (simplified)
 * @returns {Promise<Array>} - Array of contests
 */
async function getAtCoderContests() {
  try {
    const cacheKey = 'atcoder:contests';
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const contests = [
      {
        platform: 'AtCoder',
        name: 'AtCoder Beginner Contest',
        startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        duration: 100 * 60, // 100 minutes in seconds
        url: 'https://atcoder.jp/contests/',
        type: 'ABC'
      }
    ];
    
    await cache.set(cacheKey, contests, ATCODER_CACHE_TTL);
    return contests;
  } catch (error) {
    console.error('Error fetching AtCoder contests:', error);
    return [];
  }
}

module.exports = {
  getAtCoderUser,
  getAtCoderContests
};

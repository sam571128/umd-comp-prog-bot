const fetch = require('node-fetch');
const cache = require('./cache');

const PLATFORMS = {
  CODEFORCES: {
    name: 'Codeforces',
    url: 'https://codeforces.com/api/contest.list',
    color: 0x1F8ACB
  },
  ATCODER: {
    name: 'AtCoder',
    url: 'https://atcoder.jp/contests/',
    color: 0x3FAF3F
  }
};

const CONTEST_CACHE_TTL = 30 * 60 * 1000;

/**
 * Get upcoming contests from Codeforces
 * @returns {Promise<Array>} - Array of upcoming contests
 */
async function getCodeforcesContests() {
  try {
    const cacheKey = 'contests:codeforces';
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const response = await fetch(PLATFORMS.CODEFORCES.url);
    
    if (!response.ok) {
      throw new Error(`Codeforces API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Codeforces API error: ${data.comment}`);
    }
    
    const upcomingContests = data.result
      .filter(contest => contest.phase === 'BEFORE')
      .slice(0, 10) // Limit to next 10 contests
      .map(contest => ({
        platform: 'Codeforces',
        name: contest.name,
        startTime: new Date(contest.startTimeSeconds * 1000),
        duration: contest.durationSeconds,
        url: `https://codeforces.com/contest/${contest.id}`,
        id: contest.id,
        type: contest.type
      }));
    
    await cache.set(cacheKey, upcomingContests, CONTEST_CACHE_TTL);
    
    return upcomingContests;
  } catch (error) {
    console.error('Error fetching Codeforces contests:', error);
    return [];
  }
}

/**
 * Get all upcoming contests from all platforms
 * @returns {Promise<Array>} - Array of all upcoming contests
 */
async function getAllUpcomingContests() {
  try {
    const codeforcesContests = await getCodeforcesContests();
    
    const allContests = [...codeforcesContests]
      .sort((a, b) => a.startTime - b.startTime);
    
    return allContests;
  } catch (error) {
    console.error('Error fetching contests:', error);
    return [];
  }
}

/**
 * Get contests starting within the next specified hours
 * @param {number} hours - Number of hours to look ahead
 * @returns {Promise<Array>} - Array of contests starting soon
 */
async function getContestsStartingSoon(hours = 24) {
  try {
    const allContests = await getAllUpcomingContests();
    const now = new Date();
    const cutoffTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    
    return allContests.filter(contest => 
      contest.startTime >= now && contest.startTime <= cutoffTime
    );
  } catch (error) {
    console.error('Error filtering contests starting soon:', error);
    return [];
  }
}

/**
 * Format duration from seconds to human readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format time until contest starts
 * @param {Date} startTime - Contest start time
 * @returns {string} - Formatted time until start
 */
function formatTimeUntilStart(startTime) {
  const now = new Date();
  const diff = startTime - now;
  
  if (diff < 0) {
    return 'Started';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

module.exports = {
  getAllUpcomingContests,
  getContestsStartingSoon,
  getCodeforcesContests,
  formatDuration,
  formatTimeUntilStart,
  PLATFORMS
};

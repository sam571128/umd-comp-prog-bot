const { getData, saveData } = require('./database');
const { getUser, getUserSubmission } = require('./codeforces');

/**
 * Get comprehensive user statistics
 * @param {string} discordUserId - Discord user ID
 * @returns {Promise<Object>} - User analytics data
 */
async function getUserAnalytics(discordUserId) {
  try {
    const handle = await getData(discordUserId);
    if (!handle) {
      throw new Error('User not registered. Use /cf_reg to register your Codeforces handle first.');
    }

    const [userInfo, submissions] = await Promise.all([
      getUser(handle),
      getUserSubmission(handle, 0) // Get all submissions
    ]);

    if (userInfo.status !== 'OK' || submissions.status !== 'OK') {
      throw new Error('Failed to fetch user data from Codeforces');
    }

    const user = userInfo.result[0];
    const userSubmissions = submissions.result;

    const analytics = calculateUserAnalytics(user, userSubmissions);
    
    await saveData(`analytics:${discordUserId}`, {
      ...analytics,
      lastUpdated: new Date(),
      handle: handle
    });

    return analytics;
  } catch (error) {
    console.error('Error getting user analytics:', error);
    throw error;
  }
}

/**
 * Calculate detailed analytics from user data
 * @param {Object} user - Codeforces user object
 * @param {Array} submissions - Array of user submissions
 * @returns {Object} - Calculated analytics
 */
function calculateUserAnalytics(user, submissions) {
  const analytics = {
    basic: {
      handle: user.handle,
      rating: user.rating || 0,
      maxRating: user.maxRating || 0,
      rank: user.rank || 'unrated',
      maxRank: user.maxRank || 'unrated',
      contribution: user.contribution || 0
    },
    submissions: {
      total: submissions.length,
      accepted: 0,
      wrongAnswer: 0,
      timeLimitExceeded: 0,
      memoryLimitExceeded: 0,
      compilationError: 0,
      runtimeError: 0,
      other: 0
    },
    problems: {
      solved: new Set(),
      attempted: new Set(),
      byRating: {},
      byTags: {}
    },
    activity: {
      firstSubmission: null,
      lastSubmission: null,
      streaks: {
        current: 0,
        longest: 0
      },
      submissionsByMonth: {}
    }
  };

  submissions.forEach(submission => {
    const verdict = submission.verdict;
    const problem = submission.problem;
    const submissionTime = new Date(submission.creationTimeSeconds * 1000);
    
    switch (verdict) {
      case 'OK':
        analytics.submissions.accepted++;
        analytics.problems.solved.add(`${problem.contestId}${problem.index}`);
        break;
      case 'WRONG_ANSWER':
        analytics.submissions.wrongAnswer++;
        break;
      case 'TIME_LIMIT_EXCEEDED':
        analytics.submissions.timeLimitExceeded++;
        break;
      case 'MEMORY_LIMIT_EXCEEDED':
        analytics.submissions.memoryLimitExceeded++;
        break;
      case 'COMPILATION_ERROR':
        analytics.submissions.compilationError++;
        break;
      case 'RUNTIME_ERROR':
        analytics.submissions.runtimeError++;
        break;
      default:
        analytics.submissions.other++;
    }

    analytics.problems.attempted.add(`${problem.contestId}${problem.index}`);

    if (problem.rating) {
      const ratingRange = Math.floor(problem.rating / 100) * 100;
      analytics.problems.byRating[ratingRange] = (analytics.problems.byRating[ratingRange] || 0) + 1;
    }

    if (problem.tags) {
      problem.tags.forEach(tag => {
        analytics.problems.byTags[tag] = (analytics.problems.byTags[tag] || 0) + 1;
      });
    }

    if (!analytics.activity.firstSubmission || submissionTime < analytics.activity.firstSubmission) {
      analytics.activity.firstSubmission = submissionTime;
    }
    if (!analytics.activity.lastSubmission || submissionTime > analytics.activity.lastSubmission) {
      analytics.activity.lastSubmission = submissionTime;
    }

    const monthKey = `${submissionTime.getFullYear()}-${String(submissionTime.getMonth() + 1).padStart(2, '0')}`;
    analytics.activity.submissionsByMonth[monthKey] = (analytics.activity.submissionsByMonth[monthKey] || 0) + 1;
  });

  analytics.problems.solvedCount = analytics.problems.solved.size;
  analytics.problems.attemptedCount = analytics.problems.attempted.size;
  analytics.problems.solved = Array.from(analytics.problems.solved);
  analytics.problems.attempted = Array.from(analytics.problems.attempted);

  analytics.submissions.successRate = analytics.submissions.total > 0 
    ? (analytics.submissions.accepted / analytics.submissions.total * 100).toFixed(1)
    : 0;

  return analytics;
}

/**
 * Get weak areas for a user based on their submission history
 * @param {string} discordUserId - Discord user ID
 * @returns {Promise<Array>} - Array of weak areas with suggestions
 */
async function getWeakAreas(discordUserId) {
  try {
    const analytics = await getUserAnalytics(discordUserId);
    const weakAreas = [];

    const tagStats = {};
    const handle = analytics.basic.handle;
    const submissions = await getUserSubmission(handle, 0);
    
    if (submissions.status === 'OK') {
      submissions.result.forEach(submission => {
        if (submission.problem.tags) {
          submission.problem.tags.forEach(tag => {
            if (!tagStats[tag]) {
              tagStats[tag] = { total: 0, accepted: 0 };
            }
            tagStats[tag].total++;
            if (submission.verdict === 'OK') {
              tagStats[tag].accepted++;
            }
          });
        }
      });

      Object.entries(tagStats).forEach(([tag, stats]) => {
        if (stats.total >= 5) { // Only consider tags with at least 5 attempts
          const successRate = (stats.accepted / stats.total) * 100;
          if (successRate < 50) { // Less than 50% success rate
            weakAreas.push({
              area: tag,
              successRate: successRate.toFixed(1),
              attempts: stats.total,
              solved: stats.accepted,
              suggestion: `Practice more ${tag} problems to improve your success rate`
            });
          }
        }
      });
    }

    weakAreas.sort((a, b) => parseFloat(a.successRate) - parseFloat(b.successRate));

    return weakAreas.slice(0, 5); // Return top 5 weak areas
  } catch (error) {
    console.error('Error analyzing weak areas:', error);
    throw error;
  }
}

module.exports = {
  getUserAnalytics,
  getWeakAreas,
  calculateUserAnalytics
};

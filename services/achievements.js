const { getData, saveData } = require('./database');
const { getUserAnalytics } = require('./analytics');

const ACHIEVEMENTS = {
  NEWBIE_GRADUATE: {
    id: 'newbie_graduate',
    name: 'Newbie Graduate',
    description: 'Reach 1200+ rating',
    emoji: '🎓',
    category: 'rating',
    condition: (analytics) => analytics.basic.rating >= 1200
  },
  PUPIL_POWER: {
    id: 'pupil_power',
    name: 'Pupil Power',
    description: 'Reach 1400+ rating',
    emoji: '💪',
    category: 'rating',
    condition: (analytics) => analytics.basic.rating >= 1400
  },
  SPECIALIST_STATUS: {
    id: 'specialist_status',
    name: 'Specialist Status',
    description: 'Reach 1600+ rating',
    emoji: '⭐',
    category: 'rating',
    condition: (analytics) => analytics.basic.rating >= 1600
  },
  EXPERT_LEVEL: {
    id: 'expert_level',
    name: 'Expert Level',
    description: 'Reach 1900+ rating',
    emoji: '🏆',
    category: 'rating',
    condition: (analytics) => analytics.basic.rating >= 1900
  },
  CANDIDATE_MASTER: {
    id: 'candidate_master',
    name: 'Candidate Master',
    description: 'Reach 2100+ rating',
    emoji: '👑',
    category: 'rating',
    condition: (analytics) => analytics.basic.rating >= 2100
  },

  FIRST_SOLVE: {
    id: 'first_solve',
    name: 'First Steps',
    description: 'Solve your first problem',
    emoji: '🌟',
    category: 'problems',
    condition: (analytics) => analytics.problems.solvedCount >= 1
  },
  PROBLEM_SOLVER_10: {
    id: 'problem_solver_10',
    name: 'Problem Solver',
    description: 'Solve 10 problems',
    emoji: '🧩',
    category: 'problems',
    condition: (analytics) => analytics.problems.solvedCount >= 10
  },
  PROBLEM_CRUSHER_50: {
    id: 'problem_crusher_50',
    name: 'Problem Crusher',
    description: 'Solve 50 problems',
    emoji: '💥',
    category: 'problems',
    condition: (analytics) => analytics.problems.solvedCount >= 50
  },
  CENTURY_CLUB: {
    id: 'century_club',
    name: 'Century Club',
    description: 'Solve 100 problems',
    emoji: '💯',
    category: 'problems',
    condition: (analytics) => analytics.problems.solvedCount >= 100
  },
  PROBLEM_MASTER_500: {
    id: 'problem_master_500',
    name: 'Problem Master',
    description: 'Solve 500 problems',
    emoji: '🎯',
    category: 'problems',
    condition: (analytics) => analytics.problems.solvedCount >= 500
  },

  PERSISTENT: {
    id: 'persistent',
    name: 'Persistent',
    description: 'Make 100 submissions',
    emoji: '🔄',
    category: 'submissions',
    condition: (analytics) => analytics.submissions.total >= 100
  },
  DEDICATED: {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Make 500 submissions',
    emoji: '🎪',
    category: 'submissions',
    condition: (analytics) => analytics.submissions.total >= 500
  },
  SUBMISSION_KING: {
    id: 'submission_king',
    name: 'Submission King',
    description: 'Make 1000 submissions',
    emoji: '👑',
    category: 'submissions',
    condition: (analytics) => analytics.submissions.total >= 1000
  },

  SHARPSHOOTER: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieve 70%+ success rate with 50+ submissions',
    emoji: '🎯',
    category: 'accuracy',
    condition: (analytics) => analytics.submissions.total >= 50 && parseFloat(analytics.submissions.successRate) >= 70
  },
  SNIPER: {
    id: 'sniper',
    name: 'Sniper',
    description: 'Achieve 80%+ success rate with 100+ submissions',
    emoji: '🏹',
    category: 'accuracy',
    condition: (analytics) => analytics.submissions.total >= 100 && parseFloat(analytics.submissions.successRate) >= 80
  },

  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Active for 30+ days',
    emoji: '🐦',
    category: 'special',
    condition: (analytics) => {
      if (!analytics.activity.firstSubmission) return false;
      const daysSinceFirst = Math.floor((Date.now() - analytics.activity.firstSubmission.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceFirst >= 30;
    }
  },
  VETERAN: {
    id: 'veteran',
    name: 'Veteran',
    description: 'Active for 365+ days',
    emoji: '🏅',
    category: 'special',
    condition: (analytics) => {
      if (!analytics.activity.firstSubmission) return false;
      const daysSinceFirst = Math.floor((Date.now() - analytics.activity.firstSubmission.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceFirst >= 365;
    }
  },
  DIVERSE_SOLVER: {
    id: 'diverse_solver',
    name: 'Diverse Solver',
    description: 'Solve problems with 10+ different tags',
    emoji: '🌈',
    category: 'special',
    condition: (analytics) => Object.keys(analytics.problems.byTags).length >= 10
  }
};

/**
 * Check and update achievements for a user
 * @param {string} discordUserId - Discord user ID
 * @returns {Promise<Object>} - Achievement status and newly earned achievements
 */
async function checkAchievements(discordUserId) {
  try {
    const analytics = await getUserAnalytics(discordUserId);
    
    const currentAchievements = await getData(`achievements:${discordUserId}`) || {};
    const newlyEarned = [];
    
    Object.values(ACHIEVEMENTS).forEach(achievement => {
      if (!currentAchievements[achievement.id] && achievement.condition(analytics)) {
        currentAchievements[achievement.id] = {
          ...achievement,
          earnedAt: new Date(),
          handle: analytics.basic.handle
        };
        newlyEarned.push(achievement);
      }
    });
    
    if (newlyEarned.length > 0) {
      await saveData(`achievements:${discordUserId}`, currentAchievements);
    }
    
    return {
      total: Object.keys(currentAchievements).length,
      possible: Object.keys(ACHIEVEMENTS).length,
      achievements: currentAchievements,
      newlyEarned: newlyEarned
    };
  } catch (error) {
    console.error('Error checking achievements:', error);
    throw error;
  }
}

/**
 * Get user achievements
 * @param {string} discordUserId - Discord user ID
 * @returns {Promise<Object>} - User achievements
 */
async function getUserAchievements(discordUserId) {
  try {
    const achievements = await getData(`achievements:${discordUserId}`) || {};
    return {
      total: Object.keys(achievements).length,
      possible: Object.keys(ACHIEVEMENTS).length,
      achievements: achievements
    };
  } catch (error) {
    console.error('Error getting user achievements:', error);
    throw error;
  }
}

/**
 * Get leaderboard of users by achievement count
 * @param {number} limit - Number of users to return
 * @returns {Promise<Array>} - Achievement leaderboard
 */
async function getAchievementLeaderboard(limit = 10) {
  try {
    const leaderboard = [];
    
    
    return leaderboard;
  } catch (error) {
    console.error('Error getting achievement leaderboard:', error);
    return [];
  }
}

module.exports = {
  ACHIEVEMENTS,
  checkAchievements,
  getUserAchievements,
  getAchievementLeaderboard
};

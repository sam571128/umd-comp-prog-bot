const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const analyticsService = require('../services/analytics');
const { handleCommandError } = require('../utils/errorHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View detailed analytics of your competitive programming progress')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View analytics for another user (optional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option
        .setName('private')
        .setDescription('Make the response visible only to you (default: false)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const isPrivate = interaction.options.getBoolean('private') || false;
      await interaction.deferReply({ ephemeral: isPrivate });
      
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userId = targetUser.id;
      
      const analytics = await analyticsService.getUserAnalytics(userId);
      
      const embed = new EmbedBuilder()
        .setColor(0x1F8ACB)
        .setTitle(`📊 Analytics for ${analytics.basic.handle}`)
        .setThumbnail('https://sta.codeforces.com/s/76530/images/codeforces-telegram-square.png')
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL({ size: 64, dynamic: true })
        });

      embed.addFields({
        name: '🏆 Rating & Rank',
        value: `**Current:** ${analytics.basic.rating} (${analytics.basic.rank})\n**Max:** ${analytics.basic.maxRating} (${analytics.basic.maxRank})\n**Contribution:** ${analytics.basic.contribution}`,
        inline: true
      });

      embed.addFields({
        name: '📈 Submissions',
        value: `**Total:** ${analytics.submissions.total}\n**Accepted:** ${analytics.submissions.accepted}\n**Success Rate:** ${analytics.submissions.successRate}%`,
        inline: true
      });

      embed.addFields({
        name: '🧩 Problems',
        value: `**Solved:** ${analytics.problems.solvedCount}\n**Attempted:** ${analytics.problems.attemptedCount}\n**Solve Rate:** ${((analytics.problems.solvedCount / analytics.problems.attemptedCount) * 100).toFixed(1)}%`,
        inline: true
      });

      if (analytics.activity.firstSubmission && analytics.activity.lastSubmission) {
        const daysSinceFirst = Math.floor((Date.now() - analytics.activity.firstSubmission.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLast = Math.floor((Date.now() - analytics.activity.lastSubmission.getTime()) / (1000 * 60 * 60 * 24));
        
        embed.addFields({
          name: '📅 Activity',
          value: `**Active for:** ${daysSinceFirst} days\n**Last submission:** ${daysSinceLast} days ago\n**Avg submissions/day:** ${(analytics.submissions.total / Math.max(daysSinceFirst, 1)).toFixed(1)}`,
          inline: false
        });
      }

      const ratingEntries = Object.entries(analytics.problems.byRating)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .slice(0, 5);
      
      if (ratingEntries.length > 0) {
        const ratingText = ratingEntries
          .map(([rating, count]) => `**${rating}:** ${count} problems`)
          .join('\n');
        
        embed.addFields({
          name: '⭐ Problems by Rating',
          value: ratingText,
          inline: true
        });
      }

      const tagEntries = Object.entries(analytics.problems.byTags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      if (tagEntries.length > 0) {
        const tagText = tagEntries
          .map(([tag, count]) => `**${tag}:** ${count}`)
          .join('\n');
        
        embed.addFields({
          name: '🏷️ Top Tags',
          value: tagText,
          inline: true
        });
      }

      const verdictText = [
        `✅ **Accepted:** ${analytics.submissions.accepted}`,
        `❌ **Wrong Answer:** ${analytics.submissions.wrongAnswer}`,
        `⏰ **Time Limit:** ${analytics.submissions.timeLimitExceeded}`,
        `💾 **Memory Limit:** ${analytics.submissions.memoryLimitExceeded}`,
        `🔧 **Compilation Error:** ${analytics.submissions.compilationError}`,
        `💥 **Runtime Error:** ${analytics.submissions.runtimeError}`
      ].filter(line => !line.includes(': 0')).join('\n');

      if (verdictText) {
        embed.addFields({
          name: '📋 Submission Breakdown',
          value: verdictText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      if (error.message.includes('not registered')) {
        return interaction.editReply('❌ User not registered. Use `/cf_reg` to register your Codeforces handle first.');
      }
      await handleCommandError(error, interaction);
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const achievementService = require('../services/achievements');
const { handleCommandError } = require('../utils/errorHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your competitive programming achievements and badges')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View achievements for another user (optional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option
        .setName('check')
        .setDescription('Check for new achievements (default: false)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const shouldCheck = interaction.options.getBoolean('check') || false;
      const userId = targetUser.id;
      
      let achievementData;
      let newlyEarned = [];
      
      if (shouldCheck) {
        achievementData = await achievementService.checkAchievements(userId);
        newlyEarned = achievementData.newlyEarned || [];
      } else {
        achievementData = await achievementService.getUserAchievements(userId);
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🏆 Achievements for ${targetUser.username}`)
        .setDescription(`${achievementData.total}/${achievementData.possible} achievements unlocked`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 128, dynamic: true }))
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL({ size: 64, dynamic: true })
        });

      const categories = {
        rating: { name: '⭐ Rating Achievements', achievements: [] },
        problems: { name: '🧩 Problem Solving', achievements: [] },
        submissions: { name: '📊 Submission Milestones', achievements: [] },
        accuracy: { name: '🎯 Accuracy Masters', achievements: [] },
        special: { name: '🌟 Special Achievements', achievements: [] }
      };

      Object.values(achievementData.achievements).forEach(achievement => {
        if (categories[achievement.category]) {
          categories[achievement.category].achievements.push(achievement);
        }
      });

      Object.values(categories).forEach(category => {
        if (category.achievements.length > 0) {
          const achievementText = category.achievements
            .map(achievement => `${achievement.emoji} **${achievement.name}**\n   ${achievement.description}`)
            .join('\n\n');
          
          embed.addFields({
            name: category.name,
            value: achievementText,
            inline: false
          });
        }
      });

      const progressPercentage = Math.round((achievementData.total / achievementData.possible) * 100);
      const progressBar = createProgressBar(progressPercentage);
      
      embed.addFields({
        name: '📈 Progress',
        value: `${progressBar} ${progressPercentage}%`,
        inline: false
      });

      if (achievementData.total === 0) {
        embed.addFields({
          name: '🎯 Get Started',
          value: 'Start solving problems to earn your first achievements!\nUse `/cf_reg` to register and `/problem` to find problems to solve.',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      if (newlyEarned.length > 0) {
        const newAchievementEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎉 New Achievements Unlocked!')
          .setDescription(`Congratulations ${targetUser.username}! You've earned new achievements:`)
          .setTimestamp();

        newlyEarned.forEach(achievement => {
          newAchievementEmbed.addFields({
            name: `${achievement.emoji} ${achievement.name}`,
            value: achievement.description,
            inline: true
          });
        });

        await interaction.followUp({ embeds: [newAchievementEmbed] });
      }
      
    } catch (error) {
      if (error.message.includes('not registered')) {
        return interaction.editReply('❌ User not registered. Use `/cf_reg` to register your Codeforces handle first.');
      }
      await handleCommandError(error, interaction);
    }
  },
};

/**
 * Create a visual progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @returns {string} - Progress bar string
 */
function createProgressBar(percentage) {
  const totalBars = 20;
  const filledBars = Math.round((percentage / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

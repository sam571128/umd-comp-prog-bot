const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const contestService = require('../services/contests');
const { handleCommandError } = require('../utils/errorHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contests')
    .setDescription('View upcoming competitive programming contests')
    .addIntegerOption(option =>
      option
        .setName('hours')
        .setDescription('Show contests starting within this many hours (default: 168 = 1 week)')
        .setMinValue(1)
        .setMaxValue(720) // 30 days max
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const hours = interaction.options.getInteger('hours') || 168; // Default to 1 week
      const contests = await contestService.getAllUpcomingContests();
      
      if (!contests || contests.length === 0) {
        return interaction.editReply('No upcoming contests found. Please try again later.');
      }
      
      const now = new Date();
      const cutoffTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
      const filteredContests = contests.filter(contest => 
        contest.startTime >= now && contest.startTime <= cutoffTime
      );
      
      if (filteredContests.length === 0) {
        return interaction.editReply(`No contests found starting within the next ${hours} hours.`);
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🏆 Upcoming Contests')
        .setDescription(`Contests starting within the next ${hours} hours`)
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL({ size: 64, dynamic: true })
        });
      
      const contestsToShow = filteredContests.slice(0, 10);
      
      for (const contest of contestsToShow) {
        const timeUntilStart = contestService.formatTimeUntilStart(contest.startTime);
        const duration = contestService.formatDuration(contest.duration);
        const startTimeStr = contest.startTime.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        });
        
        embed.addFields({
          name: `${contest.platform}: ${contest.name}`,
          value: `⏰ **Starts in:** ${timeUntilStart}\n📅 **Time:** ${startTimeStr}\n⏱️ **Duration:** ${duration}\n🔗 [Contest Link](${contest.url})`,
          inline: false
        });
      }
      
      if (filteredContests.length > 10) {
        embed.addFields({
          name: 'Note',
          value: `Showing first 10 of ${filteredContests.length} contests. Use a smaller time window to see specific contests.`,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      await handleCommandError(error, interaction);
    }
  },
};

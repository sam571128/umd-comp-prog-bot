const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const analyticsService = require('../services/analytics');
const { handleCommandError } = require('../utils/errorHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weakareas')
    .setDescription('Analyze your weak areas and get improvement suggestions')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Analyze weak areas for another user (optional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option
        .setName('private')
        .setDescription('Make the response visible only to you (default: true)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const isPrivate = interaction.options.getBoolean('private') ?? true; // Default to private
      await interaction.deferReply({ ephemeral: isPrivate });
      
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userId = targetUser.id;
      
      const weakAreas = await analyticsService.getWeakAreas(userId);
      
      if (!weakAreas || weakAreas.length === 0) {
        return interaction.editReply('🎉 Great job! No significant weak areas found. Keep up the excellent work!');
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle(`🎯 Weak Areas Analysis`)
        .setDescription(`Areas where ${targetUser.id === interaction.user.id ? 'you' : targetUser.username} can improve`)
        .setThumbnail('https://sta.codeforces.com/s/76530/images/codeforces-telegram-square.png')
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL({ size: 64, dynamic: true })
        });

      weakAreas.forEach((area, index) => {
        const emoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || '📍';
        embed.addFields({
          name: `${emoji} ${area.area}`,
          value: `**Success Rate:** ${area.successRate}% (${area.solved}/${area.attempts})\n**Suggestion:** ${area.suggestion}`,
          inline: false
        });
      });

      embed.addFields({
        name: '💡 General Tips',
        value: '• Focus on one weak area at a time\n• Practice similar problems repeatedly\n• Review editorial solutions for failed attempts\n• Join study groups for collaborative learning\n• Use `/problem` command to find targeted practice problems',
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      if (error.message.includes('not registered')) {
        return interaction.editReply('❌ User not registered. Use `/cf_reg` to register your Codeforces handle first.');
      }
      await handleCommandError(error, interaction);
    }
  },
};

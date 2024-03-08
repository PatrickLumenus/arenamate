import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { DateTime } from 'luxon';
import { TextChannel, ChannelType, channelMention, userMention } from 'discord.js';
import { internalErrorMessageText, COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from './../lib/constants';
import { GuildProfile, getGuildProfileForGuildId, updateGuildProfile } from './../lib/firebase';
import { createEmbedForGuildProfile, createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from '#lib/utils';

@ApplyOptions<Command.Options>({
	description: 'Sets the channel where logs will be sent.',
	name: 'setlogchannel',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class SetLogChannelCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addChannelOption((option) =>
						option
							.setName('log_channel')
							.setDescription('The channel where logs will be sent.')
							.addChannelTypes(ChannelType.GuildText)
							.setRequired(true)
					),
			{
				// options
				idHints: ['1213732439718109214']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name} command.`);
		const logsChannelId = interaction.options.get('log_channel', true).channel!.id;
		const guild = interaction.guild!;

		try {
			// load the guildProfile
			this.container.logger.debug('Loading guild profile...');
			const profile = await getGuildProfileForGuildId(guild.id);
			const callerIsOwner = interaction.user.id === guild.ownerId;

			if (!profile) {
				return interaction.reply({
					content: `${this.container.client.user?.displayName} has not yet been setup for ${guild.name}. ${!callerIsOwner ? `Tell ${userMention(guild.ownerId)} to set it up.` : ''}`,
					ephemeral: true
				});
			}

			// update the role.
			this.container.logger.debug('Permission granted.');
			// check to see if the category is the same as the old.
			if (profile.log_channel_id === logsChannelId) {
				this.container.logger.debug('No changes are needed.');
				this.container.logger.info('Exiting successfully');
				return interaction.reply({
					content: `Your Arenas Category is already set to ${channelMention(logsChannelId)}. There is no need to update it.`,
					ephemeral: true
				});
			}

			// update the profile.
			this.container.logger.debug('Updating the profile');
			let newProfile: GuildProfile = {
				...profile,
				log_channel_id: logsChannelId,
				updated_at: DateTime.utc().toJSDate()
			};
			newProfile = await updateGuildProfile(newProfile);

			// log the update
			const logChannel = getLogChannelForGuuildProfile(guild, profile);

			if (logChannel instanceof TextChannel) {
				const oldLogChannel = profile.log_channel_id ? channelMention(profile.log_channel_id) : '<not set>';
				const newLogChannel = channelMention(newProfile.log_channel_id!);
				await logChannel.send({
					embeds: [
						createEmbedForGuildProfileUpdate(oldLogChannel, newLogChannel, {
							user: interaction.user,
							title: `Updated ${this.container.client.user?.displayName} Log Channel`,
							description: `The Log Channel for ${guild.name} has been updated. Arenas will now be created in ${newLogChannel}.`
						})
					]
				});
			}

			this.container.logger.info('Exiting successfully.');
			return interaction.reply({
				embeds: [createEmbedForGuildProfile(guild, newProfile)]
			});
		} catch (e) {
			// something went wrong.
			const error = e as Error;
			this.container.logger.error(error.message);
			return interaction.reply({
				content: internalErrorMessageText,
				ephemeral: true
			});
		}
	}
}

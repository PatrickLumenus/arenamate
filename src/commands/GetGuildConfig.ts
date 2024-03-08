import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { userMention } from 'discord.js';
import { getGuildProfileForGuildId } from './../lib/firebase';
import { internalErrorMessageText, COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from './../lib/constants';
import { createEmbedForGuildProfile } from '#lib/utils';

/**
 * GetGuildConfigCommand
 *
 * Gets the guild configuration for the guild.
 */

@ApplyOptions<Command.Options>({
	description: 'displays the current setup for the server.',
	name: 'config',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class GetGuildConfigCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false),
			{
				// optios
				idHints: ['1213695118842925056']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name} command`);
		const guild = interaction.guild!;
		try {
			this.container.logger.debug('Retrieving guild profile.');
			const profile = await getGuildProfileForGuildId(guild.id);
			const callerIsOwner = interaction.user.id === guild.ownerId;

			if (!profile) {
				this.container.logger.debug('Profile not found.');
				return interaction.reply({
					content: `${this.container.client.user?.displayName} has not yet been setup for ${guild.name}. ${!callerIsOwner ? `Tell ${userMention(guild.ownerId)} to set it up.` : ''}`,
					ephemeral: true
				});
			}

			// show the current configuration.
			this.container.logger.info('Exiting successfully.');
			return interaction.reply({
				embeds: [createEmbedForGuildProfile(guild, profile)]
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

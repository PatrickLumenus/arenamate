import { insufficientPermissionMessageText, internalErrorMessageText, COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from '#lib/constants';
import { GuildProfile, getGuildProfileForGuildId, updateGuildProfile } from '#lib/firebase';
import { createEmbedForGuildProfile, createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

/**
 * ActivateCommand
 *
 * enables users to create, find, and join arenas.
 */

@ApplyOptions<Command.Options>({
	name: 'activate',
	description: 'Allows users to create, find, and join arenas.',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class ActivateCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false),
			{ idHints: ['1214783900115800064'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = interaction.guild!;
		const botName = this.container.client.user?.displayName;

		try {
			// get the profile.
			const profile = await getGuildProfileForGuildId(guild.id);

			if (profile) {
				// check if the profile is already active

				if (!profile.active) {
					// update the profile.
					let updatedProfile: GuildProfile = {
						...profile,
						active: true
					};
					updatedProfile = await updateGuildProfile(updatedProfile);

					// log the changes.
					const logChannel = getLogChannelForGuuildProfile(guild, profile);

					if (logChannel) {
						await logChannel.send({
							embeds: [
								createEmbedForGuildProfileUpdate('inactive', 'active', {
									title: `${botName} Activated for ${guild.name}`,
									description: `${botName} has been activated. This means that players will now be able to crate, find, and join new arenas.`,
									user: interaction.user
								})
							]
						});
					}

					return interaction.reply({
						ephemeral: true,
						embeds: [createEmbedForGuildProfile(guild, profile)]
					});
				} else {
					// profile is already active. No need to change.
					return interaction.reply({
						ephemeral: true,
						content: `${botName} is already activated for ${guild.name}`
					});
				}
			} else {
				// profile not set up.
				let message = insufficientPermissionMessageText;
				if (interaction.user.id === guild.ownerId) {
					message = `${botName} is not yet setup for ${guild.name}. Please set it up and try again.`;
				}
				return interaction.reply({
					content: message,
					ephemeral: true
				});
			}
		} catch (e) {
			// an error occured.
			return interaction.reply({
				ephemeral: true,
				content: internalErrorMessageText
			});
		}
	}
}

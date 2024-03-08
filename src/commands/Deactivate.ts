import { ApplyOptions } from '@sapphire/decorators';
import { DateTime } from 'luxon';
import { Command } from '@sapphire/framework';
import { getLogChannelForGuuildProfile, createEmbedForGuildProfileUpdate, createEmbedForGuildProfile } from '#lib/utils';
import { getGuildProfileForGuildId, GuildProfile, updateGuildProfile } from '#lib/firebase';
import { insufficientPermissionMessageText, internalErrorMessageText, COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from '#lib/constants';

/**
 * DeactivateCommand
 *
 * prevents users to create, find, and join arenas.
 */

@ApplyOptions<Command.Options>({
	name: 'deactivate',
	description: 'Prevents users from creating and joining arenas.',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false),
			{ idHints: ['1214784215657222175'] }
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

				if (profile.active) {
					// update the profile.
					let updatedProfile: GuildProfile = {
						...profile,
						active: false,
						updated_at: DateTime.utc().toJSDate()
					};
					updatedProfile = await updateGuildProfile(updatedProfile);

					// log the changes.
					const logChannel = getLogChannelForGuuildProfile(guild, profile);

					if (logChannel) {
						await logChannel.send({
							embeds: [
								createEmbedForGuildProfileUpdate('active', 'inactive', {
									title: `${botName} Deactivated for ${guild.name}`,
									description: `${botName} has been deactivated. This means that players will no longer be able to crate, find, and join new arenas. Existing arenas will continue to work. However, users will no longer be able to update arena information.`,
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
					// profile is already deactive. No need to change.
					return interaction.reply({
						ephemeral: true,
						content: `${botName} is already deactivated for ${guild.name}`
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

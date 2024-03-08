import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { DateTime } from 'luxon';
import { Role, userMention, roleMention } from 'discord.js';
import { getGuildProfileForGuildId, updateGuildProfile } from './../lib/firebase';
import { internalErrorMessageText, COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from './../lib/constants';
import { createEmbedForGuildProfile, createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from '#lib/utils';
import { BotEvents, GuildAdminRoleUpdatedEventData } from '#lib/events';

/**
 * SetAdminRoleCommand
 *
 * sets the admin role for a guild.
 */

@ApplyOptions<Command.Options>({
	description: 'Sets the role that will be allowed to use administration commands.',
	name: 'setadminrole',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class SetAdminRoleCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addRoleOption((option) =>
						option.setName('admin_role').setDescription('users with this role will be able to run admin commands.').setRequired(true)
					),
			{
				idHints: ['1213703217792159764']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name} command.`);
		const adminRole: Role = interaction.options.get('admin_role')!.role as Role;
		const guild = interaction.guild!;

		try {
			// load the guildProfile
			this.container.logger.debug('Loading guild profile...');
			let profile = await getGuildProfileForGuildId(guild.id);
			const callerIsOwner = interaction.user.id === guild.ownerId;

			if (!profile) {
				return interaction.reply({
					content: `${this.container.client.user?.displayName} has not yet been setup for ${guild.name}. ${!callerIsOwner ? `Tell ${userMention(guild.ownerId)} to set it up.` : ''}`,
					ephemeral: true
				});
			}

			// update the role.
			const outdatedRoleId = profile.admin_role_id;
			const oldRole: string = outdatedRoleId ? roleMention(outdatedRoleId) : '<not set>';
			const newRole: string = roleMention(adminRole.id);

			// make sure the role has actually changed.
			if (profile.admin_role_id === adminRole.id) {
				this.container.logger.debug('No changes are needed.');
				this.container.logger.info('Exiting successfully');
				return interaction.reply({
					content: `Your Admin Role is already set to ${oldRole}. There is no need to update it.`,
					ephemeral: true
				});
			}

			// update the profile.
			this.container.logger.debug('Updating the profile');
			profile = {
				...profile,
				admin_role_id: adminRole.id,
				updated_at: DateTime.utc().toJSDate()
			};
			profile = await updateGuildProfile(profile);

			// log the update
			let logChannel = getLogChannelForGuuildProfile(guild, profile);

			if (logChannel) {
				await logChannel.send({
					embeds: [
						createEmbedForGuildProfileUpdate(oldRole, newRole, {
							user: interaction.user,
							title: `Updated ${this.container.client.user?.displayName} Admin Role`,
							description: `The Admin Role for ${guild.name} has been updated. From now on, users with the ${newRole} will be able to use ${this.container.client.user?.displayName} administration commands..`
						})
					]
				});
			}

			this.container.client.emit(BotEvents.GuildAdminRoleUpdated, <GuildAdminRoleUpdatedEventData>{
				guild_id: guild.id,
				old_admin_role_id: outdatedRoleId,
				new_admin_role_id: adminRole.id,
				profile: profile
			});
			this.container.logger.info('Exiting successfully.');
			return interaction.reply({
				embeds: [
					createEmbedForGuildProfile(guild, profile, {
						title: `Updated ${this.container.client.user?.displayName} Configuration for ${guild.name}`,
						description: 'Here is the updated configuration.'
					})
				]
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

import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { DateTime } from 'luxon';
import { ChannelType, userMention, channelMention, OverwriteType, OverwriteResolvable, PermissionsBitField } from 'discord.js';
import { GuildProfile, getGuildProfileForGuildId, getOpenArenasForGuild, updateGuildProfile } from './../lib/firebase';
import {
	internalErrorMessageText,
	COMMAND_COOLDOWN_LIMIT,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	ARENA_CATEGORY_USER_PERMISSIONS,
	ARENA_CATEGORY_ADMIN_PERMISSIONS
} from './../lib/constants';
import { createEmbedForGuildProfile, createEmbedForGuildProfileUpdate, getGuildUtilitiesForProfile, getLogChannelForGuuildProfile } from '#lib/utils';
import { BotEvents, GuildArenasCategoryUpdatedEventData } from '#lib/events';

/**
 * SetArenasCategoryCommand
 *
 * sets the channel where arenas will be created.
 */

@ApplyOptions<Command.Options>({
	description: 'Sets which category arenas will be created.',
	name: 'setarenacategory',
	preconditions: ['GuildStaffOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class SetArenasCategoryCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addStringOption((option) => option.setName('category_name').setDescription('The name of the arena category.').setRequired(true)),
			{
				// options
				idHints: ['1213720978727903252']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name} command.`);
		const arenasCategoryName = interaction.options.get('category_name', true).value!.toString().trim();
		const guild = interaction.guild!;

		// validate the category name.
		const existingCategory = guild.channels.cache.find((suspect) => {
			return suspect.name.toUpperCase() === arenasCategoryName.toUpperCase() && suspect.type === ChannelType.GuildCategory;
		});

		if (existingCategory) {
			return interaction.reply({
				ephemeral: true,
				content: `I was unable to update the Arenas Category for ${guild.name} because a category named '${arenasCategoryName}' already exists. Please choose a different name and try again.`
			});
		}

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

			// check if there are any open arenas.
			const openArenas = await getOpenArenasForGuild(guild.id);

			if (openArenas.length) {
				return interaction.reply({
					ephemeral: true,
					content: 'I cannot update the arenas category because there are currently open arenas. '
				});
			}

			// create the category.

			this.container.logger.debug('Creating category.');
			const permissions: OverwriteResolvable[] = [
				{
					id: guild.roles.everyone.id,
					type: OverwriteType.Role,
					allow: ARENA_CATEGORY_USER_PERMISSIONS,
					deny: [PermissionsBitField.Flags.ViewChannel]
				}
			];
			const utilities = getGuildUtilitiesForProfile(profile, guild);

			if (utilities.adminRole) {
				permissions.push({
					id: utilities.adminRole.id,
					type: OverwriteType.Role,
					allow: ARENA_CATEGORY_ADMIN_PERMISSIONS
				});
			}

			const arenasCategory = await guild.channels.create({
				name: arenasCategoryName,
				type: ChannelType.GuildCategory,
				permissionOverwrites: permissions
			});

			// update the profile.
			this.container.logger.debug('Updating the profile');
			let newProfile: GuildProfile = {
				...profile,
				arenas_category_id: arenasCategory.id,
				updated_at: DateTime.utc().toJSDate()
			};
			newProfile = await updateGuildProfile(newProfile);

			// log the update
			const logChannel = getLogChannelForGuuildProfile(guild, profile);

			if (logChannel) {
				const oldCategory = profile.arenas_category_id ? channelMention(profile.arenas_category_id) : '<not set>';
				const newCategory = newProfile.arenas_category_id ? channelMention(newProfile.arenas_category_id) : '<not set>';
				await logChannel.send({
					embeds: [
						createEmbedForGuildProfileUpdate(oldCategory, newCategory, {
							user: interaction.user,
							title: `Updated ${this.container.client.user?.displayName} Arenas Category`,
							description: `The Arenas Category for ${guild.name} has been updated. Arenas will now be created in ${newCategory}.`
						})
					]
				});
			}

			this.container.client.emit(BotEvents.GuildArenasCategoryUpdated, <GuildArenasCategoryUpdatedEventData>{
				profile: profile,
				old_category_id: utilities.arenasCategory?.id || null,
				new_category_id: arenasCategory.id
			});

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

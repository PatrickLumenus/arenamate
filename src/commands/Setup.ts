import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ChannelType, OverwriteType, Role } from 'discord.js';
import { GuildProfile, getGuildProfileForGuildId, createGuildProfile } from './../lib/firebase';
import { DateTime } from 'luxon';
import { createEmbedForGuildProfile, getLogChannelForGuuildProfile } from '#lib/utils';
import {
	DEFAULT_ADMIN_ROLE_NAME,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	ARENA_CATEGORY_USER_PERMISSIONS,
	ARENA_CATEGORY_ADMIN_PERMISSIONS
} from '#lib/constants';
import { CategoryChannel } from 'discord.js';

/**
 * SetupCommand
 *
 * The SetupCommand sets the bot up in a guild (a Discord server).
 */

@ApplyOptions<Command.Options>({
	description: 'Sets up Arenamate in your server.',
	name: 'setup',
	preconditions: ['GuildOwnerOnly'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: 5,
	enabled: true
})
export class SetupCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addStringOption((option) =>
						option.setName('category_name').setDescription('The name of the category where arenas will be created.').setRequired(true)
					)
					.addChannelOption((option) =>
						option
							.setName('log_channel')
							.setDescription('The channel where logs will be sent.')
							.addChannelTypes(ChannelType.GuildText)
							.setRequired(false)
					)
					.addRoleOption((option) =>
						option.setName('admin_role').setDescription('users with this role will be able to run admin commands.')
					),
			{
				// options
				idHints: ['1213603521522307132']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name} command.`);
		const guild = interaction.guild!;
		const arenasCategoryName: string = interaction.options.get('category_name', true).value!.toString().trim();
		let adminRole: Role | undefined =
			(interaction.options.get('admin_role')?.role as Role) || guild.roles.cache.find((suspect) => suspect.name === DEFAULT_ADMIN_ROLE_NAME);

		let arenasCategory: CategoryChannel | null = null;

		// validate the category.
		const existingCategory = guild.channels.cache.find((suspect) => {
			return suspect.name.toUpperCase() === arenasCategoryName.toUpperCase() && suspect.type === ChannelType.GuildCategory;
		});

		if (existingCategory) {
			return interaction.reply({
				ephemeral: true,
				content: `I was unable to create the Arenas Category for ${guild.name} because a category named '${arenasCategoryName}' already exists. Please choose a different name and try again.`
			});
		}

		try {
			// make sure an profile does not already exist.
			this.container.logger.info('Checking for an existing guild profile...');
			const existingProfile = await getGuildProfileForGuildId(guild.id);
			if (existingProfile) {
				return interaction.reply({
					content: `
				  It appears you already have an existing setup for ${guild.name}. If you'd like to modify the setup, please use the \`/setarenascategory\` or the \`/setadminrole\` commands instead.`,
					ephemeral: true
				});
			}

			// create the admin role.
			this.container.logger.info('Creating bot admin role');

			if (!adminRole) {
				adminRole = await interaction.guild!.roles.create({
					name: DEFAULT_ADMIN_ROLE_NAME,
					mentionable: false,
					reason: `
				  This role was created specifically to specify which users can use
						${this.container.client.user?.displayName} bot's administration
						commands.
				`
				});
			}

			// create the arena category.
			this.container.logger.debug('Creating arenas category.');
			arenasCategory = await interaction.guild!.channels.create({
				name: arenasCategoryName,
				type: ChannelType.GuildCategory,
				reason: `This category was created specifically for the ${this.container.client.user?.displayName} bot to create arena channels in.`,
				permissionOverwrites: [
					{
						id: guild.roles.everyone.id,
						type: OverwriteType.Role,
						allow: ARENA_CATEGORY_USER_PERMISSIONS
					},
					{
						id: adminRole.id,
						type: OverwriteType.Role,
						allow: ARENA_CATEGORY_ADMIN_PERMISSIONS
					}
				]
			});

			// create the guild profile.
			this.container.logger.info('Creating guild profile.');
			const now = DateTime.utc().toJSDate();
			let profile: GuildProfile = {
				active: true,
				admin_role_id: adminRole.id,
				arenas_category_id: arenasCategory.id,
				guild_id: guild.id,
				owner_id: guild.ownerId,
				log_channel_id: interaction.options.get('log_channel', false)?.channel?.id || null,
				created_at: now,
				updated_at: now,
				deleted_at: null
			};
			profile = await createGuildProfile(profile);
			this.container.logger.info('Successfully created guild profile.');

			// log changes
			const logChannel = getLogChannelForGuuildProfile(guild, profile);

			if (logChannel) {
				this.container.logger.info('Logging changes.');
				await logChannel.send({
					embeds: [
						createEmbedForGuildProfile(guild, profile, {
							title: `${this.container.client.user?.displayName} Setup Complete`,
							description: `${this.container.client.user?.displayName} has successfully been setup in ${guild.name}`,
							type: 'setup'
						})
					]
				});
			}
			this.container.logger.info('Exiting successfully.');
			const botName = this.container.client.user?.displayName;
			return interaction.reply({
				embeds: [
					createEmbedForGuildProfile(guild, profile, {
						title: `${botName} Setup Complete`,
						description: `Your ${botName} setup is complete. I look forward to helping you with your community's arenas.`
					})
				],
				ephemeral: true
			});
		} catch (e) {
			const error = e as Error;
			this.container.logger.error(error.message);
			this.container.logger.debug('Undoing changes...');
			// undo any changes to the server.
			if (arenasCategory) {
				// delete the category.
				await arenasCategory.delete();
			}

			if (adminRole) {
				// delete the admin role.
				await adminRole.delete();
			}

			return interaction.reply({
				content: `Something went wrong while I was getting things setup. Don't worry, I reverted everything to how it was before. Please try again or contat support.`,
				ephemeral: true
			});
		}
	}
}

import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
	COMMAND_COOLDOWN_LIMIT,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	SSBU_INVALID_ARENA_INFO_ERROR_TEXT,
	internalErrorMessageText,
	insufficientPermissionMessageText,
	ARENA_CHANNEL_PLAYER_PERMISSIONS
} from './../lib/constants';
import {
	GuildUtilities,
	validSSBUArenaDetails,
	createExistingArenaErrorMessageForTextChannel,
	getLogChannelForGuuildProfile,
	createEmbedForOpenArena,
	getGuildUtilitiesForProfile
} from '#lib/utils';
import { ArenaInfo, createArena, getGuildProfileForGuildId, getOpenArenasForUserId } from './../lib/firebase';
import { Guild, OverwriteType, TextChannel, userMention, roleMention, channelMention, User, PermissionsBitField } from 'discord.js';
import { ChannelType } from 'discord.js';
import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { ArenaOpenedEventData, BotEvents } from '#lib/events';

/**
 * CreateArenaCommand
 *
 * Creates an arena.
 */

@ApplyOptions<Command.Options>({
	description: 'Creates a new arena',
	name: 'open',
	preconditions: ['GuildProfileArenaCategorySet', 'ActiveGuild'],
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class CreateArenaCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addNumberOption((option) =>
						option
							.setName('size')
							.setDescription('the number of players allowed in the arena')
							.setMinValue(2)
							.setMaxValue(8)
							.setRequired(true)
					)
					.addStringOption((option) => option.setName('arena_id').setDescription('the arena ID').setRequired(true).setMaxLength(5))
					.addStringOption((option) =>
						option.setName('arena_password').setDescription('the arena password, if applicable').setRequired(false).setMaxLength(8)
					),
			{
				idHints: ['1214474691532824586']
			}
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info('Executing ' + this.name);
		const arenaId: string = interaction.options.get('arena_id')!.value!.toString().trim().toUpperCase();
		const arenaPw: string | null = interaction.options.get('arena_password')?.value?.toString().trim() || null;
		const arenaSize: number = interaction.options.get('size')!.value as number;
		const guild = interaction.guild!;
		const sender = interaction.user;

		// validate arena details.
		this.container.logger.debug('Validating arena information');
		if (!validSSBUArenaDetails(arenaId, arenaPw)) {
			this.container.logger.debug('Arena information invalid.');
			return interaction.reply({ content: SSBU_INVALID_ARENA_INFO_ERROR_TEXT, ephemeral: true });
		}

		let arenaChannel: TextChannel | null = null;
		try {
			// get the guild profile
			this.container.logger.debug('Retriving guild profile.');
			const guildProfile = await getGuildProfileForGuildId(guild.id);
			if (!guildProfile) {
				// server is not set up.
				this.container.logger.debug('Guild profile not found.');
				return interaction.reply({
					content: insufficientPermissionMessageText,
					ephemeral: true
				});
			}
			this.container.logger.debug('Getting guild utility channel.');
			const guildUtilities = getGuildUtilitiesForProfile(guildProfile, guild);

			if (!guildUtilities.adminRole || !guildUtilities.arenasCategory) {
				// the arenas category is not set up. Or, it's been deleted.
				this.container.logger.debug('Guild utility channels not set up properly.');
				return interaction.reply({
					ephemeral: true,
					content: `Sorry, I cannot create your arena because ${this.container.client.user?.displayName} is not properly set up for ${guild.name}. For assistance, please reach out to ${userMention(guildProfile.owner_id)} ${guildProfile.admin_role_id ? `or ${roleMention(guildProfile.admin_role_id)}` : ''}`
				});
			}

			// make sure the caller doesn't have any arenas still open.'
			this.container.logger.debug('Checking if user has an existing open arena.');
			const existingArenaChannel = await this.getExistingArenaChannelForUser(sender, guild);

			if (!existingArenaChannel) {
				// create the arenas channel.
				this.container.logger.debug('Creating arena channel.');
				arenaChannel = await this.createArenaChannel(arenaId, sender, guild, guildUtilities);
				// create the record.
				this.container.logger.debug('Saving arena record.');
				const now = DateTime.utc().toJSDate();
				const arenaRecord: ArenaInfo = {
					id: uuid(),
					arena_channel_id: arenaChannel.id,
					arena_current_players: 1,
					arena_id: arenaId,
					arena_password: arenaPw,
					arena_owner: sender.id,
					arena_participants: [sender.id],
					guild_id: guildProfile.guild_id,
					fill_rate: 1 / arenaSize,
					private: true,
					arena_size: arenaSize,
					created_at: now,
					updated_at: now,
					closed_at: null
				};
				await createArena(arenaRecord);
				this.container.client.emit(BotEvents.ArenaOpened, <ArenaOpenedEventData>{ arena: arenaRecord });

				// log the changes.
				const logChannel = getLogChannelForGuuildProfile(guild, guildProfile);

				if (logChannel) {
					await logChannel.send({
						embeds: [createEmbedForOpenArena(sender, arenaChannel)]
					});
				}

				this.container.logger.debug('Exiting successfully');
				return interaction.reply({
					ephemeral: true,
					content: `Great news, I have created your arena in ${channelMention(arenaChannel.id)}. \n\nHave fun!`
				});
			} else {
				// the user still has an open arena.
				// we need to tell the user to either leave it or close it before starting a new one.
				this.container.logger.debug('User still has open arena.');
				return interaction.reply({
					ephemeral: true,
					content: createExistingArenaErrorMessageForTextChannel(existingArenaChannel)
				});
			}
		} catch (e) {
			// undo any changes, if any.
			this.container.logger.error((e as Error).message);
			this.container.logger.debug('Undoing changes...');
			if (arenaChannel) {
				// delete the arenas channel.
				await arenaChannel.delete();
			}
			this.container.logger.debug('Aborting operation...');
			return interaction.reply({
				ephemeral: true,
				content: internalErrorMessageText
			});
		}
	}

	private async getExistingArenaChannelForUser(user: User, guild: Guild): Promise<TextChannel | null> {
		let openArenas = await getOpenArenasForUserId(user.id);
		this.container.logger.debug(`Open Arenas from db: ${openArenas.length}`);
		const openArena = openArenas.find((arena) => arena.guild_id === guild.id);
		this.container.logger.debug(`Open Arena in Guild: ${openArena?.id}`);
		let channel: TextChannel | null = null;

		if (openArena) {
			channel = (guild.channels.cache.get(openArena.arena_channel_id) as TextChannel) || null;
		}
		return channel;
	}

	private async createArenaChannel(channelName: string, owner: User, guild: Guild, utilities: GuildUtilities): Promise<TextChannel> {
		return await guild.channels.create({
			name: channelName,
			parent: utilities.arenasCategory,
			type: ChannelType.GuildText,
			reason: `This channel is automatically created and managed by ${this.container.client.user?.displayName}.`,
			permissionOverwrites: [
				{
					allow: ARENA_CHANNEL_PLAYER_PERMISSIONS,
					id: owner.id,
					type: OverwriteType.Member
				},
				{
					allow: ARENA_CHANNEL_PLAYER_PERMISSIONS,
					id: utilities.adminRole!.id,
					type: OverwriteType.Role
				},
				{
					deny: [PermissionsBitField.Flags.ViewChannel],
					id: guild.roles.everyone.id,
					type: OverwriteType.Role
				}
			]
		});
	}
}

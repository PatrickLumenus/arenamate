import type { ChatInputCommandSuccessPayload, Command, ContextMenuCommandSuccessPayload, MessageCommandSuccessPayload } from '@sapphire/framework';
import { container } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { cyan } from 'colorette';
import { EmbedBuilder, type APIUser, type Guild, type Message, User, userMention, roleMention, channelMention, Role, TextChannel } from 'discord.js';
import { RandomLoadingMessage, embedSignatureText, UNSET } from './constants';
import { ArenaInfo, GuildProfile } from './firebase';
import { CategoryChannel } from 'discord.js';
import { DateTime } from 'luxon';

// ============================================
// Sapphire Utils
// ============================================

/**
 * Picks a random item from an array
 * @param array The array to pick a random item from
 * @example
 * const randomEntry = pickRandom([1, 2, 3, 4]) // 1
 */
export function pickRandom<T>(array: readonly T[]): T {
	const { length } = array;
	return array[Math.floor(Math.random() * length)];
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
	return send(message, { embeds: [new EmbedBuilder().setDescription(pickRandom(RandomLoadingMessage)).setColor('#FF0000')] });
}

export function logSuccessCommand(payload: ContextMenuCommandSuccessPayload | ChatInputCommandSuccessPayload | MessageCommandSuccessPayload): void {
	let successLoggerData: ReturnType<typeof getSuccessLoggerData>;

	if ('interaction' in payload) {
		successLoggerData = getSuccessLoggerData(payload.interaction.guild, payload.interaction.user, payload.command);
	} else {
		successLoggerData = getSuccessLoggerData(payload.message.guild, payload.message.author, payload.command);
	}

	container.logger.debug(`${successLoggerData.shard} - ${successLoggerData.commandName} ${successLoggerData.author} ${successLoggerData.sentAt}`);
}

export function getSuccessLoggerData(guild: Guild | null, user: User, command: Command) {
	const shard = getShardInfo(guild?.shardId ?? 0);
	const commandName = getCommandInfo(command);
	const author = getAuthorInfo(user);
	const sentAt = getGuildInfo(guild);

	return { shard, commandName, author, sentAt };
}

function getShardInfo(id: number) {
	return `[${cyan(id.toString())}]`;
}

function getCommandInfo(command: Command) {
	return cyan(command.name);
}

function getAuthorInfo(author: User | APIUser) {
	return `${author.username}[${cyan(author.id)}]`;
}

function getGuildInfo(guild: Guild | null) {
	if (guild === null) return 'Direct Messages';
	return `${guild.name}[${cyan(guild.id)}]`;
}

// ============================================
// Custom Utils
// ============================================

type EmbedType = 'update' | 'critical' | 'alert' | 'setup';

interface GuildProfileEmbedOptions {
	readonly title?: string;
	readonly description?: string;
	readonly type?: EmbedType;
}

/**
 * createEmbedForGuildProfile()
 *
 * creates an embed for a guild profile.
 */
export const createEmbedForGuildProfile = (guild: Guild, profile: GuildProfile, options: GuildProfileEmbedOptions = {}) => {
	container.logger.debug(`Executing ${createEmbedForGuildProfile.name}()`);
	const botName = container.client.user!.displayName;
	const title = options.title || `${botName} Configuration for ${guild.name}`;
	const description = options.description || `Your current ${botName} configuration.`;
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setFooter({ text: embedSignatureText })
		.addFields(
			{ name: 'Server', value: guild.name },
			{ name: 'Server Owner', value: userMention(profile.owner_id) },
			{ name: 'Arenas Category', value: profile.arenas_category_id ? channelMention(profile.arenas_category_id) : UNSET },
			{ name: 'Arena Admin', value: profile.admin_role_id ? roleMention(profile.admin_role_id) : UNSET },
			{ name: 'Log Channel', value: profile.log_channel_id ? channelMention(profile.log_channel_id) : UNSET },
			{ name: 'Status', value: profile.active ? 'active' : 'inactive' }
		);

	if (options.type) {
		switch (options.type) {
			case 'critical':
				embed.setColor(0xff0000);
				break;
			case 'alert':
				embed.setColor(0xffff00);
				break;
			case 'setup':
				embed.setColor(0x0000ff);
				break;
			default:
				embed.setColor(0x00ff00);
		}
	}

	container.logger.debug(`Exiting ${createEmbedForGuildProfile.name}()`);
	return embed;
};

interface GuildProfileUpdateEmbedOptions extends GuildProfileEmbedOptions {
	readonly user?: User;
}

/**
 * createEmbedForGuildProfileUpdate()
 *
 * creates an embed for a guild profile update.
 */
export const createEmbedForGuildProfileUpdate = (oldValue: string | null, newValue: string | null, options: GuildProfileUpdateEmbedOptions = {}) => {
	const botName = container.client.user!.displayName;
	const title = options.title || `Updated ${botName} Configuration.`;
	const description = options.description || 'Your configuration has been updated.';
	const type = options.type || 'update';
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setFooter({ text: embedSignatureText })
		.addFields({ name: 'Old', value: oldValue || UNSET }, { name: 'New', value: newValue || UNSET });

	if (options.user) {
		embed.addFields({ name: 'Updated By', value: userMention(options.user.id) });
	}

	switch (type) {
		case 'critical':
			embed.setColor(0xff0000);
			break;
		case 'alert':
			embed.setColor(0xffff00);
			break;
		case 'setup':
			embed.setColor(0x0000ff);
			break;
		default:
			embed.setColor(0x00ff00);
	}

	return embed;
};

/**
 * createEmbedForErrorMessage()
 *
 * creates an error message embed.
 */
export const createEmbedForErrorMessage = (title: string, description: string) => {
	return new EmbedBuilder().setTitle(title).setDescription(description).setFooter({ text: embedSignatureText }).setColor(0xff0000);
};

/**
 * createEmbedForOpenArena()
 *
 * creates an embed for an open arena.
 */
export const createEmbedForOpenArena = (owner: User, channel: TextChannel) => {
	const arenaOwner = userMention(owner.id);
	const arenaChannel = channelMention(channel.id);
	return new EmbedBuilder()
		.setTitle('An Arena Has Been Opened')
		.setDescription(`An arena has been opened by ${arenaOwner}`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields({ name: 'channel', value: arenaChannel });
};

/**
 * createEmbedForUpdatedArena()
 *
 * creates an embed for an updated arena.
 */
export const createEmbedForUpdatedArena = (arena: ArenaInfo) => {
	return new EmbedBuilder()
		.setTitle('An Arena Has Been Updated')
		.setDescription(`An arena has been closed by ${userMention(arena.arena_owner)}`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields({ name: 'channel', value: channelMention(arena.arena_channel_id) });
};

/**
 * createEmbedForClosedArena()
 *
 * creates an embed for a closed arena.
 */

export const createEmbedForClosedArena = (arena: ArenaInfo, channel: TextChannel) => {
	const arenaOwner = userMention(arena.arena_owner);
	const arenaChannel = `#${channel.name}`;
	const creation = DateTime.fromISO(arena.created_at).setZone('utc');
	let destruction: DateTime | null = null;

	if (arena.closed_at) {
		destruction = DateTime.fromISO(arena.closed_at).setZone('utc');
	}

	const embed = new EmbedBuilder()
		.setTitle('An Arena Has Been Closed')
		.setDescription(`An arena has been closed by ${arenaOwner}`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields({ name: 'channel', value: arenaChannel });

	if (destruction) {
		const duration = destruction.diff(creation);
		embed.addFields({ name: 'Duration', value: `${duration.as('minutes').toFixed(2)} minutes` });
	}

	return embed;
};

/**
 * createEmbedForForceClosedArena()
 *
 * creates an embed for a force-closed arena.
 */

export const createEmbedForForceClosedArena = (arena: ArenaInfo, channel: TextChannel) => {
	const arenaChannel = `#${channel.name}`;
	const creation = DateTime.fromISO(arena.created_at).setZone('utc');
	let destruction: DateTime | null = null;

	if (arena.closed_at) {
		destruction = DateTime.fromISO(arena.closed_at).setZone('utc');
	}

	const embed = new EmbedBuilder()
		.setTitle('An Arena Has Been Force Closed')
		.setDescription(
			`An arena has been force closed. Arenas that have been opened for more than 8 hours are considered to be inactive and closed automatically.`
		)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields({ name: 'channel', value: arenaChannel });

	if (destruction) {
		const duration = destruction.diff(creation);
		embed.addFields({ name: 'Duration', value: `${duration.as('minutes').toFixed(2)} minutes` });
	}

	return embed;
};

export interface GuildUtilities {
	arenasCategory: CategoryChannel | null;
	adminRole: Role | null;
}

/**
 * createExistingArenaErrorMessageForTextChannel()
 *
 * creates an error message stating the user is still participating in an active arena in the specified channel.
 */

export const createExistingArenaErrorMessageForTextChannel = (channel: TextChannel): string => {
	return `Sorry, you cannot open a new arena because you are currently in the ${channelMention(channel.id)} arena. Please leave or close it before opening a new one.`;
};

/**
 * getLogChannelForGuildProfile()
 *
 * gets teh log channel for the guild, using the guild profile.
 * @param guild the guild to search.
 * @param profile the guild profile.
 * @returns TextChannel representing the log channel for the guild, or null if it isn't found.
 */

export const getLogChannelForGuuildProfile = (guild: Guild, profile: GuildProfile): TextChannel | null => {
	let channel: TextChannel | null = null;
	if (profile.log_channel_id) {
		channel = (guild.channels.cache.get(profile.log_channel_id) as TextChannel) || null;
	}
	return channel;
};

/**
 * getGuildUtilitiesForProfile()
 *
 * gets the guild category and role for a given profile.
 */
export const getGuildUtilitiesForProfile = (profile: GuildProfile, guild: Guild): GuildUtilities => {
	let channel: CategoryChannel | null = null;
	if (profile.arenas_category_id) {
		channel = guild.channels.cache.get(profile.arenas_category_id) as CategoryChannel | null;
	}

	let role: Role | null = null;

	if (profile.admin_role_id) {
		role = guild.roles.cache.get(profile.admin_role_id) || null;
	}

	return {
		adminRole: role,
		arenasCategory: channel
	};
};

// ============================================
// SSBU-specific utilities
// ============================================

/**
 * validSSBUArenaDetails()
 *
 * returns true if the SSBU arena ID and arena password are valid. Returns false otherwise.
 * @param arena_id the SSBU arena ID.
 * @param arena_password the SSBU arena password.
 */

export const validSSBUArenaDetails = (arena_id: string, arena_password: string | null) => {
	const validId = arena_id.length == 5 && /^[a-hj-np-y0-9]+$/i.test(arena_id);
	const validPw = arena_password ? /^\d+$/.test(arena_password) && arena_password.length <= 8 : true;
	return validId && validPw;
};

/**
 * createEmbedForArenaInfo()
 *
 * creates an embed for arena information.
 */
export const createEmbedForArenaInformation = (arena: ArenaInfo) => {
	return new EmbedBuilder()
		.setTitle('Arena Information')
		.setDescription(
			`To join the arena from the start screen, go to Online -> Smash -> Battle Arena -> Join Arena -> Enter Arena ID. Then, enter the Arena ID and Password below. If the information is incorrect, the owner can update it with the ${`\`/arena\``} command.`
		)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields(
			{ name: 'Arena ID', value: arena.arena_id },
			{ name: 'Arena Password', value: arena.arena_password || 'none' },
			{ name: 'Current Players', value: `${arena.arena_current_players}/${arena.arena_size}` }
		);
};

/**
 * createEmbedForArenaSearchResults
 *
 * Creates an embed for arena search results.
 */
export const createEmbedForArenasSearchResults = (arenas: ArenaInfo[]) => {
	const arenaData = arenas.map((arena) => {
		return `${userMention(arena.arena_owner)}: ${arena.arena_current_players}/${arena.arena_size}`;
	});
	const message = arenaData.length
		? `Here are some arenas you can join:\n${arenaData.join('\n')}`
		: "Sorry, I couldn't find any arenas for you. Please try again later or start your own.";
	return new EmbedBuilder().setTitle('Arenas You Can Join').setDescription(message).setFooter({ text: embedSignatureText }).setColor(0xffff00);
};

/**
 * createEmbedForArenaJoin
 *
 * creates an embed for a message stating a user has joined an arena.
 */

export const createEmbedForArenaJoin = (arena: ArenaInfo, user: User) => {
	return new EmbedBuilder()
		.setTitle('User Has Joined An Arena')
		.setDescription(`Someone has joined an arena.`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields(
			{ name: 'Arena', value: channelMention(arena.arena_channel_id) },
			{ name: 'User', value: userMention(user.id) },
			{ name: 'Current Players', value: `${arena.arena_current_players}/${arena.arena_size}` }
		);
};

export const createEmbedForMovedArenas = (newCategory: CategoryChannel, count: number) => {
	return new EmbedBuilder()
		.setTitle('Arena Channels Have Been Moved')
		.setDescription(`${count} arena channels have been moved to ${channelMention(newCategory.id)}`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields(
			{ name: 'Arena', value: channelMention(arena.arena_channel_id) },
			{ name: 'User', value: userMention(user.id) },
			{ name: 'Current Players', value: `${arena.arena_current_players}/${arena.arena_size}` }
		);
};

/**
 * createEmbedForArenaLeave
 *
 * creates an embed for a message stating a user has left an arena.
 */

export const createEmbedForArenaLeave = (arena: ArenaInfo, user: User) => {
	return new EmbedBuilder()
		.setTitle('User Has Left An Arena')
		.setDescription(`Someone has Left an arena.`)
		.setFooter({ text: embedSignatureText })
		.setColor(0xffff00)
		.addFields(
			{ name: 'Arena', value: channelMention(arena.arena_channel_id) },
			{ name: 'User', value: userMention(user.id) },
			{ name: 'Current Players', value: `${arena.arena_current_players}/${arena.arena_size}` }
		);
};

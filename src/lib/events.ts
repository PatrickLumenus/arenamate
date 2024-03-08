// events

import { User, CategoryChannel } from 'discord.js';
import { ArenaInfo, GuildProfile } from './firebase';
import { TextChannel } from 'discord.js';

export enum BotEvents {
	GuildAdminRoleUpdated = 'guildAdminRoleUpdate',
	GuildArenasCategoryUpdated = 'guldArenasCategoryUpdate',
	GuildArenasCategoryDeleted = 'guildArenasCategoryDelete',
	GuildLogChannelDeleted = 'guildLogChanelDelete',
	ArenaOpened = 'arenaOpened',
	ArenaClosed = 'arenaClosed',
	ArenaUpdated = 'arenaUpdated',
	ArenaJoin = 'arenaJoin',
	ArenaLeave = 'arenaLeave',
	ArenaForceClosed = 'arenaForceClose',
	ArenaChannelDeleted = 'arenaChannelDelete'
}

export interface GuildLogChanelDeletedEventData {
	readonly profile: GuildProfile;
	readonly channel: TextChannel;
}

export interface GuildArenasCategoryDeletedEventData {
	readonly profile: GuildProfile;
	readonly category: CategoryChannel;
}

export interface GuildAdminRoleUpdatedEventData {
	readonly guild_id: string;
	readonly new_admin_role_id: string;
	readonly old_admin_role_id?: string;
	readonly profile: GuildProfile;
}

export interface GuildArenasCategoryUpdatedEventData {
	readonly profile: GuildProfile;
	readonly old_category_id: string | null;
	readonly new_category_id: string;
}

export interface ArenaOpenedEventData {
	readonly arena: ArenaInfo;
}

export interface ArenaClosedEventData {
	readonly arena: ArenaInfo;
	readonly profile?: GuildProfile;
}

export interface ArenaUpdatedEventData {
	readonly arena: ArenaInfo;
	readonly profile: GuildProfile;
}

export interface ArenaJoinEventData {
	readonly arena: ArenaInfo;
	user: User;
	profile: GuildProfile;
}

export interface ArenaLeaveEventData {
	readonly arena: ArenaInfo;
	readonly user: User;
	readonly profile: GuildProfile;
}

export interface ArenaForceCloseEventData {
	readonly arena: ArenaInfo;
}

export interface ArenaChannelDeletedEventData {
	readonly profile: GuildProfile;
	readonly arena: ArenaInfo;
	readonly channel: TextChannel;
}

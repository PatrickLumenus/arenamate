import { internalErrorMessageText, insufficientPermissionMessageText } from './../lib/constants';
import { GuildProfile, getGuildProfileForGuildId } from '#lib/firebase';
import { Precondition } from '@sapphire/framework';
import {
	ChannelType,
	GuildBasedChannel,
	type ChatInputCommandInteraction,
	type ContextMenuCommandInteraction,
	type Guild,
	type Message,
	TextChannel
} from 'discord.js';
import { createEmbedForErrorMessage } from '#lib/utils';

/**
 * GuildProfileArenaCategorySetPrecondition
 *
 * A precondition ensuring a profile is set and that the guild has a valid arenas category set.
 */

export class GuildProfileArenaCategorySetPrecondition extends Precondition {
	public override async messageRun(message: Message) {
		const guild = message.guild;

		if (guild) {
			// do further testing.
			try {
				const pass = await this.guildIsSetup(guild);
				if (pass) {
					return this.ok();
				} else {
					return this.error({ message: insufficientPermissionMessageText });
				}
			} catch (e) {
				return this.error({ message: internalErrorMessageText });
			}
		} else {
			return this.error({ message: insufficientPermissionMessageText });
		}
	}

	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		const guild = interaction.guild;

		if (guild) {
			// do further testing.
			try {
				const pass = await this.guildIsSetup(guild);
				if (pass) {
					return this.ok();
				} else {
					return this.error({ message: insufficientPermissionMessageText });
				}
			} catch (e) {
				return this.error({ message: internalErrorMessageText });
			}
		} else {
			return this.error({ message: insufficientPermissionMessageText });
		}
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		const guild = interaction.guild;

		if (guild) {
			// do further testing.
			try {
				const pass = await this.guildIsSetup(guild);
				if (pass) {
					return this.ok();
				} else {
					return this.error({ message: insufficientPermissionMessageText });
				}
			} catch (e) {
				return this.error({ message: internalErrorMessageText });
			}
		} else {
			return this.error({ message: insufficientPermissionMessageText });
		}
	}

	/**
	 * guildIsSetup()
	 *
	 * determines if the guild is setup.
	 * @returns true if the guild is setup. False otherwise.
	 * @throws DatabaseException when there is a database error.
	 */

	private async guildIsSetup(guild: Guild): Promise<boolean> {
		const profile = await getGuildProfileForGuildId(guild.id);

		if (profile) {
			const isSetup = this.arenasCategorySet(guild, profile);

			if (!isSetup) {
				await this.logUnsetArenasCategory(guild, profile);
			}
			return isSetup;
		} else {
			return false;
		}
	}

	private async logUnsetArenasCategory(guild: Guild, profile: GuildProfile): Promise<void> {
		let logChannel: TextChannel | null = null;

		if (profile.arenas_category_id) {
			logChannel = (guild.channels.cache.get(profile.arenas_category_id) as TextChannel) || null;
		}

		if (logChannel) {
			await logChannel.send({
				embeds: [
					createEmbedForErrorMessage(
						`Failed to Create an Arena`,
						`A member of your community wanted to create an arena. However, ${this.container.client.user?.displayName} isn't properly set up. Be sure to set it up or update your configuration so your members can enjoy arenas.`
					)
				]
			});
		}
	}

	/**
	 * arenasCategorySet()
	 *
	 * determines if the arenas category is set.
	 * @returns true if the arenas category is set. False otherwise.
	 */

	private arenasCategorySet(guild: Guild, profile: GuildProfile): boolean {
		let isValid: boolean = false;

		if (profile && profile.arenas_category_id) {
			const channel: GuildBasedChannel | null = guild.channels.cache.get(profile.arenas_category_id) || null;
			isValid = channel !== null && channel.type === ChannelType.GuildCategory;
		}

		return isValid;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		GuildProfileArenaCategorySet: never;
	}
}

import { BotEvents, GuildArenasCategoryUpdatedEventData } from '#lib/events';
import { ApplyOptions } from '@sapphire/decorators';
import { retry } from '@sapphire/utilities';
import { Listener } from '@sapphire/framework';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { getOpenArenasForGuild } from '#lib/firebase';
import { CategoryChannel, TextChannel } from 'discord.js';
import { createEmbedForMovedArenas, getLogChannelForGuuildProfile } from '#lib/utils';

/**
 * MoveOpenArenasToNewCategory
 *
 * Moved all the open arenas to the new category.
 */

@ApplyOptions<Listener.Options>({
	name: 'move-open-arenas-to-new-category',
	event: BotEvents.GuildArenasCategoryUpdated,
	enabled: false
})
export class UserEvent extends Listener {
	public override async run(event: GuildArenasCategoryUpdatedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.profile.guild_id);

		if (guild) {
			try {
				const newCategory = guild.channels.cache.get(event.new_category_id)! as CategoryChannel;
				// get all the open arenas for the guild.
				const openArenas = await retry(async () => {
					return await getOpenArenasForGuild(guild.id);
				}, MAX_RETRY_ATTEMPTS);
				// get all the arena channels associated with the arenas.
				const arenaTuples = openArenas.map((arena) => {
					return {
						info: arena,
						channel: (guild.channels.cache.get(arena.arena_channel_id) as TextChannel) || null
					};
				});
				// add the arenas to the new category (sequencially)
				let count = 0;
				for (const tuple of arenaTuples) {
					if (tuple.channel) {
						// update the parent.
						await retry(async () => {
							await tuple.channel.edit({
								parent: newCategory
							});
						}, MAX_RETRY_ATTEMPTS);
						count++;
					} else {
						// channel was deleted. Skip it.
						this.container.logger.debug('Arena channel not found. Skipping...');
					}
				}
				// log the changes.
				const logChannel = getLogChannelForGuuildProfile(guild, event.profile);

				if (logChannel) {
					await retry(async () => {
						await logChannel.send({ embeds: [createEmbedForMovedArenas(newCategory, count)] });
					}, MAX_RETRY_ATTEMPTS);
				}
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
		} else {
			// we were kicked out of the server.
			this.container.logger.debug('No action needed.');
		}

		this.container.logger.info('Exiting successfully');
	}
}

import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaChannelDeletedEventData, BotEvents } from '#lib/events';
import { closeArena } from '#lib/firebase';
import { createEmbedForClosedArena, getLogChannelForGuuildProfile } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';

/**
 * CloseArenaForDeletedChannelsListener
 *
 * closes an arena if the arena channel is deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'close-arena-for-deleted-channels',
	event: BotEvents.ArenaChannelDeleted,
	enabled: true
})
export class CloseArenaForDeletedChannelsListener extends Listener {
	public override async run(event: ArenaChannelDeletedEventData) {
		this.container.logger.info('Executing ' + this.name);

		try {
			// delete the arena.
			this.container.logger.debug('Closing arena...');
			const closedArena = await retry(async () => {
				return await closeArena(event.arena);
			}, MAX_RETRY_ATTEMPTS);

			// log the changes.
			const logChannel = getLogChannelForGuuildProfile(this.container.client.guilds.cache.get(event.profile.guild_id)!, event.profile);
			if (logChannel) {
				this.container.logger.debug('Logging changes...');
				await logChannel.send({
					embeds: [createEmbedForClosedArena(closedArena, event.channel)]
				});
			}
		} catch (e) {}

		this.container.logger.info('Exiting successfully');
	}
}

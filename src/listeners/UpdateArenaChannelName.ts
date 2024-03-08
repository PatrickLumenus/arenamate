import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { BotEvents, ArenaUpdatedEventData } from '#lib/events';
import { TextChannel } from 'discord.js';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';

/**
 * UpdateArenaChannelNameEventListener
 *
 * updates an arena channel's channel name in response to the arena being updated.
 */

@ApplyOptions<Listener.Options>({
	name: 'update-arena-channel-name',
	event: BotEvents.ArenaUpdated,
	enabled: true
})
export class UpdateArenaChannelNameEventListener extends Listener {
	public override async run(event: ArenaUpdatedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.arena.guild_id)!;
		const channel: TextChannel | null = (guild.channels.cache.get(event.arena.arena_channel_id) as TextChannel) || null;

		if (channel) {
			// update the channel
			try {
				await retry(async () => {
					await channel.edit({
						name: event.arena.arena_id,
						reason: `${this.container.client.user?.displayName} arena information for this channel was updated. So, the channel name was updated to reflect those changes.`
					});
				}, MAX_RETRY_ATTEMPTS);
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
		}
		this.container.logger.info('Exiting successfully');
	}
}

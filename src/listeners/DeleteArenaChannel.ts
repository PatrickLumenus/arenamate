import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaClosedEventData, BotEvents } from '#lib/events';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { TextChannel } from 'discord.js';

/**
 * DeleteArenaChannel
 *
 * Deletes an arena channel when the arena is closed.
 */

@ApplyOptions<Listener.Options>({
	name: 'delete-arena-channel',
	event: BotEvents.ArenaClosed
})
export class UserEvent extends Listener {
	public override async run(event: ArenaClosedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.profile?.guild_id || event.arena.guild_id)!;

		await retry(async () => {
			try {
				const channel = guild.channels.cache.get(event.arena.arena_channel_id) as TextChannel;

				if (channel) {
					await retry(async () => await channel.delete(), MAX_RETRY_ATTEMPTS);
				}
			} catch (e) {
				this.container.logger.error((e as Error).message);
				throw e;
			}
		}, MAX_RETRY_ATTEMPTS);
	}
}

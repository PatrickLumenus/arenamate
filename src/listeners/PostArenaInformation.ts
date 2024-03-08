import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { ArenaOpenedEventData, BotEvents } from '#lib/events';
import { TextChannel } from 'discord.js';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { createEmbedForArenaInformation } from '#lib/utils';

/**
 * ArenaOpenEventListener
 *
 * A listener that posts the arena iinformation to the channel whnen a new arena is created.
 */

@ApplyOptions<Listener.Options>({
	name: 'arena-open',
	event: BotEvents.ArenaOpened
})
export class ArenaOpenEventListener extends Listener {
	public override async run(event: ArenaOpenedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		this.container.logger.debug('Retrieving arena channel.');
		const guild = this.container.client.guilds.cache.get(event.arena.guild_id)!;
		const arenaChannel: TextChannel = guild.channels.cache.get(event.arena.arena_channel_id)! as TextChannel;
		try {
			this.container.logger.debug('Posting arena information...');
			await retry(async () => {
				await arenaChannel.send({
					embeds: [createEmbedForArenaInformation(event.arena)]
				});
			}, MAX_RETRY_ATTEMPTS);
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
		this.container.logger.debug('Exiting successfully');
	}
}

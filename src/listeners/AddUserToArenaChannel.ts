import { ArenaJoinEventData, BotEvents } from '#lib/events';
import { ApplyOptions } from '@sapphire/decorators';
import { retry } from '@sapphire/utilities';
import { Listener } from '@sapphire/framework';
import { TextChannel } from 'discord.js';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { userMention } from 'discord.js';

/**
 * AddUserTOArenaChannelListener
 *
 * adds a user to the arena channel.
 */

@ApplyOptions<Listener.Options>({
	name: 'add-user-to-arena-channel',
	event: BotEvents.ArenaJoin,
	enabled: true
})
export class AddUserTOArenaChannelListener extends Listener {
	public override async run(event: ArenaJoinEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.arena.guild_id)!;
		const channel = (guild.channels.cache.get(event.arena.arena_channel_id) as TextChannel) || null;

		if (channel) {
			// add the user to the channel.
			try {
				await retry(async () => {
					await channel.permissionOverwrites.create(event.user.id, {
						ViewChannel: true,
						SendMessages: true,
						ReadMessageHistory: true,
						AddReactions: true,
						UseApplicationCommands: true
					});
				}, MAX_RETRY_ATTEMPTS);
				await retry(async () => {
					await channel.send({ content: `${userMention(event.user.id)} has joined the arena.` });
				}, MAX_RETRY_ATTEMPTS);
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
		}
		this.container.logger.info('Exiting successfully');
	}
}

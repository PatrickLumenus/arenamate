import { ArenaLeaveEventData, BotEvents } from '#lib/events';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ApplyOptions } from '@sapphire/decorators';
import { retry } from '@sapphire/utilities';
import { Listener } from '@sapphire/framework';
import { TextChannel, userMention } from 'discord.js';

/**
 * RemoveUserFromArenaChannel
 *
 * Automatically removes a user from an arena channel when they leave the arena.
 */

@ApplyOptions<Listener.Options>({
	name: 'remove-user-from-arena-channel',
	event: BotEvents.ArenaLeave,
	enabled: true
})
export class UserEvent extends Listener {
	public override async run(event: ArenaLeaveEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.arena.guild_id)!;
		const channel = (guild.channels.cache.get(event.arena.arena_channel_id) as TextChannel) || null;

		if (channel) {
			// add the user to the channel.
			try {
				await retry(async () => {
					this.container.logger.info(`Removing user to arena channel.`);
					await channel.permissionOverwrites.delete(event.user);
				}, MAX_RETRY_ATTEMPTS);
				await retry(async () => {
					await channel.send({ content: `${userMention(event.user.id)} has left the arena.` });
				}, MAX_RETRY_ATTEMPTS);
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
		}
		this.container.logger.info('Exiting successfully');
	}
}

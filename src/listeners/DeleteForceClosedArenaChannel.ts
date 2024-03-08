import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaForceCloseEventData, BotEvents } from '#lib/events';
import { getGuildProfileForGuildId } from '#lib/firebase';
import { createEmbedForForceClosedArena, getLogChannelForGuuildProfile } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { TextChannel } from 'discord.js';

/**
 * DeleteForceClosedArenaChannelListener
 *
 * Deletes an arena channel when it is force closed.
 */

@ApplyOptions<Listener.Options>({
	name: 'delete-force-closed-arena-channel',
	event: BotEvents.ArenaForceClosed,
	enabled: true
})
export class DeleteForceClosedArenaChannelListener extends Listener {
	public override async run(event: ArenaForceCloseEventData) {
		this.container.logger.info(`Executing ${this.name}`);

		try {
			// get the guild.
			const guild = this.container.client.guilds.cache.get(event.arena.guild_id);

			if (guild) {
				// get the guild profile.
				const profile = await retry(async () => {
					return await getGuildProfileForGuildId(guild.id);
				}, MAX_RETRY_ATTEMPTS);
				// delete the channel.
				const channel = guild.channels.cache.get(event.arena.arena_channel_id);

				if (profile && channel) {
					await retry(async () => {
						await channel.delete();
					}, MAX_RETRY_ATTEMPTS);

					// log the changes.
					const logChannel = getLogChannelForGuuildProfile(guild, profile);

					if (logChannel) {
						await retry(async () => {
							await logChannel.send({
								embeds: [createEmbedForForceClosedArena(event.arena, channel as TextChannel)]
							});
						}, MAX_RETRY_ATTEMPTS);
					}
				}
			} else {
				// well, they probably kicked us out. So, we don't need to do anything.
			}

			this.container.logger.info('Exiting successfully');
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
	}
}

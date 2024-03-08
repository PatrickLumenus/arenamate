import { ApplyOptions } from '@sapphire/decorators';
import { Listener, Events } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { GuildChannel, ChannelType, DMChannel } from 'discord.js';
import { getGuildProfileForGuildId, getOpenArenasForChannelId } from './../lib/firebase';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaChannelDeletedEventData, BotEvents, GuildArenasCategoryDeletedEventData, GuildLogChanelDeletedEventData } from '#lib/events';

/**
 * UtilityChannelDeletedListener
 *
 * A listener that determines the right course of action when a utility channel has been abruptly deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'arena-bot-utility-channel-deleted',
	event: Events.ChannelDelete,
	enabled: true
})
export class UtilityChannelDeletedListener extends Listener {
	public override async run(channel: DMChannel | GuildChannel) {
		this.container.logger.debug('Executing ' + this.name);
		if (channel instanceof GuildChannel) {
			try {
				this.container.logger.debug('Getting profile...');
				const profile = await retry(async () => {
					return await getGuildProfileForGuildId(channel.guild.id);
				}, MAX_RETRY_ATTEMPTS);

				if (profile) {
					this.container.logger.debug('Determining what wass deleted.');
					// determne what was deleted.
					if (channel.type === ChannelType.GuildCategory && profile.arenas_category_id === channel.id) {
						// it is a category channel that was deleted.
						this.container.logger.debug('Arenas category deletd');
						this.container.client.emit(BotEvents.GuildArenasCategoryDeleted, <GuildArenasCategoryDeletedEventData>{
							profile: profile,
							category: channel
						});
					} else if (channel.type === ChannelType.GuildText) {
						// it is either a log channel or an arena channel.
						if (profile.log_channel_id === channel.id) {
							// log channel deleted.
							this.container.logger.debug('Log channel deleted.');
							this.container.client.emit(BotEvents.GuildLogChannelDeleted, <GuildLogChanelDeletedEventData>{
								profile: profile,
								channel: channel
							});
						} else {
							// it was an arena channel. Determine if it was closed or if the channel was accidentally deleted.
							this.container.logger.debug('Arenas Channel deleted. Determining if it closed normally.');
							const openArena = await retry(async () => {
								return await getOpenArenasForChannelId(channel.id, channel.guild.id);
							}, MAX_RETRY_ATTEMPTS);

							if (openArena) {
								// the arena channel was deleted.
								this.container.logger.debug('Arena channel was deleted.');
								this.container.client.emit(BotEvents.ArenaChannelDeleted, <ArenaChannelDeletedEventData>{
									profile: profile,
									channel: channel,
									arena: openArena
								});
							} else {
								// the arena was closed normally. No action needed.
								this.container.logger.debug('Arena Channel closed normally.');
							}
						}
						this.container.logger.debug('Bot not set up.');
					} else {
						// not a utility channel.
						this.container.logger.debug('No action necessary.');
					}
				} else {
					// bot not set up. no action needed.
					this.container.logger.debug('No action necessary.');
				}
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
		}
		this.container.logger.debug('Exiting successfully');
	}
}

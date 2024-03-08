import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaClosedEventData, BotEvents, GuildArenasCategoryDeletedEventData } from '#lib/events';
import { forceCloseOpenArenasForGuild } from '#lib/firebase';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { profile } from 'console';

/**
 * ForceCloseOpenArenasWhenArenaCategoryDeleted
 *
 * force closes all open channels in a guild when the arenas category is deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'force-close-open-arenas-when-arenas-category-deleted',
	event: BotEvents.GuildArenasCategoryDeleted,
	enabled: true
})
export class UserEvent extends Listener {
	public override async run(event: GuildArenasCategoryDeletedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = event.category.guild;

		try {
			this.container.logger.debug('Force closing arenas in guild.');
			const closedArenas = await retry(async () => {
				return await forceCloseOpenArenasForGuild(guild.id);
			}, MAX_RETRY_ATTEMPTS);
			this.container.logger.debug('Publishing events.');
			closedArenas.forEach((arena) => {
				this.container.client.emit(BotEvents.ArenaClosed, <ArenaClosedEventData>{
					profile: event.profile,
					arena: arena
				});
			});
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
		this.container.logger.info('Exiting successfully');
	}
}

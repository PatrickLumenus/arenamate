import { BotEvents, GuildArenasCategoryUpdatedEventData } from '#lib/events';
import { ApplyOptions } from '@sapphire/decorators';
import { retry } from '@sapphire/utilities';
import { Listener } from '@sapphire/framework';
import { GuildBasedChannel } from 'discord.js';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';

/**
 * DeleteOutdatedArenasCategoryListener
 *
 * deletes the outdated arenas category.
 */

@ApplyOptions<Listener.Options>({
	name: 'delete-outdated-arenas-category',
	event: BotEvents.GuildArenasCategoryUpdated
})
export class UserEvent extends Listener {
	public override async run(event: GuildArenasCategoryUpdatedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = this.container.client.guilds.cache.get(event.profile.guild_id)!;
		let oldCategory: GuildBasedChannel | null = null;

		if (event.old_category_id) {
			oldCategory = guild.channels.cache.get(event.old_category_id) || null;

			if (oldCategory) {
				this.container.logger.debug('Deleting old category');
				try {
					await retry(async () => await oldCategory!.delete(), MAX_RETRY_ATTEMPTS);
					this.container.logger.debug('Delete complete.');
				} catch (e) {
					this.container.logger.error((e as Error).message);
				}
			} else {
				// old category is deleted.
				this.container.logger.debug('No action necessary');
			}
		} else {
			// arenas category was previously null
			this.container.logger.debug('No action necessary');
		}
		this.container.logger.info('Exiting successfully');
	}
}

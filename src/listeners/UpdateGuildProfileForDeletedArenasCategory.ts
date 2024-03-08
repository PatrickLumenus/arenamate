import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { BotEvents, GuildArenasCategoryDeletedEventData } from '#lib/events';
import { GuildProfile, updateGuildProfile } from '#lib/firebase';
import { createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';

/**
 * UpdateGuildProfileForDeletedArenasCategoryListener
 *
 * Updates the guild profile when a guild category is manually deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'update-guild-profile-for-deleted-arenas-category',
	event: BotEvents.GuildArenasCategoryDeleted,
	enabled: true
})
export class UpdateGuildProfileForDeletedArenasCategoryListener extends Listener {
	public override async run(event: GuildArenasCategoryDeletedEventData) {
		this.container.logger.info(`Executing ${this.name}`);

		try {
			this.container.logger.debug('Updating profile.');
			let updatedProfile: GuildProfile = {
				...event.profile,
				arenas_category_id: null
			};
			updatedProfile = await retry(async () => {
				return await updateGuildProfile(updatedProfile);
			}, MAX_RETRY_ATTEMPTS);
			this.container.logger.debug('Profile updated successfully');

			// log the changes.
			this.container.logger.debug('Logging changes.');
			let logChannel = getLogChannelForGuuildProfile(this.container.client.guilds.cache.get(event.profile.guild_id)!, event.profile);
			if (logChannel) {
				await logChannel.send({
					embeds: [
						createEmbedForGuildProfileUpdate(event.category.name, null, {
							title: `${this.container.client.user?.displayName} Arenas Category Has Been Deleted for ${event.category.guild.name}`,
							description:
								'Your Arenas category has been deleted. Without setting it, your members will be unable to create arenas. This usually occurs when someone in your server manually deletes the category.',
							type: 'critical'
						})
					]
				});
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
		this.container.logger.info('Exiting successfully');
	}
}

import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { BotEvents, GuildLogChanelDeletedEventData } from '#lib/events';
import { GuildProfile, updateGuildProfile } from '#lib/firebase';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';

/**
 * UpdateGuildProfileForDeletedLogChannelListener
 *
 * Updates the guild profile when the logger log channel is deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'update-guild-profile-for-deleted-log-channel',
	event: BotEvents.GuildLogChannelDeleted,
	enabled: true
})
export class UpdateGuildProfileForDeletedLogChannelListener extends Listener {
	public override async run(event: GuildLogChanelDeletedEventData) {
		this.container.logger.info(`Executing ${this.name}`);

		try {
			let updatedProfile: GuildProfile = {
				...event.profile,
				log_channel_id: null
			};
			updatedProfile = await retry(async () => {
				return await updateGuildProfile(updatedProfile);
			}, MAX_RETRY_ATTEMPTS);
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}

		this.container.logger.info('Exiting successfully');
	}
}

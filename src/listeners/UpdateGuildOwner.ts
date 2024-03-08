import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from '#lib/utils';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener, Events } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { Guild, userMention } from 'discord.js';
import { GuildProfile, getGuildProfileForGuildId, updateGuildProfile } from 'lib/firebase';

/**
 * UpdateGuildOwnerListener
 *
 * Updates the guild profile when the guild owner has been updated.
 */

@ApplyOptions<Listener.Options>({
	name: 'update-guild-owner',
	event: Events.GuildUpdate,
	enabled: true
})
export class UpdateGuildOwnerListener extends Listener {
	public override async run(oldGuild: Guild, newGuild: Guild) {
		this.container.logger.info(`Executing ${this.name}`);

		if (oldGuild.ownerId !== newGuild.ownerId) {
			// the guild owner has changed.
			try {
				const profile = await retry(async () => {
					this.container.logger.debug('Retrieving profile.');
					return await getGuildProfileForGuildId(newGuild.id);
				}, MAX_RETRY_ATTEMPTS);

				if (profile) {
					// update the profile.
					let updatedProfile: GuildProfile = {
						...profile,
						owner_id: newGuild.ownerId
					};
					updatedProfile = await retry(async () => {
						return await updateGuildProfile(updatedProfile);
					}, MAX_RETRY_ATTEMPTS);
					// log the changes
					const logChannel = getLogChannelForGuuildProfile(newGuild, updatedProfile);

					if (logChannel) {
						await retry(async () => {
							await logChannel.send({
								embeds: [
									createEmbedForGuildProfileUpdate(userMention(oldGuild.ownerId), userMention(newGuild.ownerId), {
										title: `${newGuild.name} Owner Has Been Updated`,
										description: `The owner of ${newGuild.name} has been updated.`
									})
								]
							});
						}, MAX_RETRY_ATTEMPTS);
						this.container.logger.debug('Update complete.');
					}
				} else {
					// guild not set up.
					this.container.logger.debug('No changes necessary');
				}
			} catch (e) {
				this.container.logger.error((e as Error).message);
			}
			this.container.logger.info('Exiting successfully');
		}
	}
}

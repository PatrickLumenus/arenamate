import { ApplyOptions } from '@sapphire/decorators';
import { Listener, Events } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { Role, userMention } from 'discord.js';
import { GuildProfile, getGuildProfileForGuildId, updateGuildProfile } from './../lib/firebase';
import { createEmbedForGuildProfileUpdate, getLogChannelForGuuildProfile } from './../lib/utils';
import { DateTime } from 'luxon';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';

/**
 * UtilityRoleDeletedListener
 *
 * A listener that updates the guild profile if a utility role is deleted.
 */

@ApplyOptions<Listener.Options>({
	name: 'bot-utility-role-deleted',
	event: Events.GuildRoleDelete,
	enabled: true
})
export class UtilityRoleDeletedListener extends Listener {
	public override async run(role: Role) {
		this.container.logger.info(`Executing ${this.name}`);

		try {
			// get the profile
			let profile = await getGuildProfileForGuildId(role.guild.id);

			// check if the deleted role is the admin role.
			if (profile && profile.admin_role_id === role.id) {
				// update the profile
				profile = await retry(async () => await this.deleteGuildAdminRoleFromProfile(profile!), MAX_RETRY_ATTEMPTS);
				this.container.logger.debug('Successfully updated guild profile.');

				// log the changes.
				this.container.logger.debug('Logging changes.');
				const logChannel = getLogChannelForGuuildProfile(role.guild, profile);

				if (logChannel) {
					await retry(async () => {
						await logChannel.send({
							embeds: [
								createEmbedForGuildProfileUpdate(`@${role.name}`, null, {
									title: `${this.container.client.user?.displayName} Admin Role Has Been Deleted`,
									description: `The Admin Role for ${role.guild.name} has been deleted. This usually happens when someone in your server manually deletes the role. Until the Admin Role is set again, only ${userMention(profile!.owner_id)} will be able to run administrative commands.`,
									type: 'alert'
								})
							]
						});
					}, MAX_RETRY_ATTEMPTS);
				}
			} else {
				// no action needed.
				this.container.logger.debug('No changes necessary.');
			}
		} catch (e) {
			// an error occured
			const error = e as Error;
			this.container.logger.error(error.message);
			throw error;
		}
		this.container.logger.info('Exiting successfully');
	}

	/**
	 * deleteGuildAdminRole()
	 *
	 * Deletes the admin role.
	 * @returns the updated GuildProfile
	 * @throws DatabaseExceptioon when the operation fails.
	 * @throws RecordNotFoundException when the record for the profile is not found.
	 */
	private async deleteGuildAdminRoleFromProfile(profile: GuildProfile): Promise<GuildProfile> {
		profile = {
			...profile,
			admin_role_id: null,
			updated_at: DateTime.utc().toJSDate()
		};
		return await updateGuildProfile(profile);
	}
}

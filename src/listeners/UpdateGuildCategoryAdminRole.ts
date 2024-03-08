import { BotEvents, GuildAdminRoleUpdatedEventData } from '#lib/events';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { GuildChannel, Role } from 'discord.js';
import { retry } from '@sapphire/utilities';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';

/**
 * UpdateGuildCategoryAdminRoleListener
 *
 * updates the arenas category, reflecting the changes to the admin roles.
 * @note This operation has a change to fail. If it does, it will remove all the admin roles
 * from the category, making it only possible for the server owner to perform moderation tasks.
 */

@ApplyOptions<Listener.Options>({
	name: 'update-guild-category-admin-role',
	event: BotEvents.GuildAdminRoleUpdated,
	enabled: true
})
export class UpdateGuildCategoryAdminRoleListener extends Listener {
	public override async run(data: GuildAdminRoleUpdatedEventData) {
		this.container.logger.info(`Executing ${this.name}`);
		let newRole: Role | null = null;
		let oldRole: Role | null = null;
		let category: GuildChannel | null = null;
		let categoryRoleAdded = false;
		try {
			this.container.logger.debug('Retrieving guild...');
			const guild = this.container.client.guilds.cache.get(data.profile.guild_id)!;
			newRole = guild.roles.cache.get(data.new_admin_role_id)!;

			if (data.profile.arenas_category_id) {
				category = (guild.channels.cache.get(data.profile.arenas_category_id) as GuildChannel) || null;
				this.container.logger.debug('Updating ategory.');

				if (category) {
					// add the new role to the category.
					await retry(async () => {
						await category!.permissionOverwrites.create(newRole!, {
							ViewChannel: true,
							SendMessages: true,
							ReadMessageHistory: true,
							AddReactions: true,
							UseApplicationCommands: true
						});
					}, MAX_RETRY_ATTEMPTS);
					categoryRoleAdded = true;

					// delete the old role if it exists.
					if (data.old_admin_role_id) {
						oldRole = guild.roles.cache.get(data.old_admin_role_id) || null;

						if (oldRole) {
							this.container.logger.debug('Deleting old admin role.');
							await retry(async () => await category!.permissionOverwrites.delete(oldRole!), MAX_RETRY_ATTEMPTS);
						}
					}
					this.container.logger.debug('Update complete.');
				} else {
					// arena category was manually deleted.
					this.container.logger.debug('Arenas category manually deleted.');
				}
			} else {
				// arena category is unset.
				this.container.logger.debug('Arenas category unset...');
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
			// undo operations.

			if (categoryRoleAdded) {
				// remove the new role.
				await category!.permissionOverwrites.delete(newRole!);
			}
			throw e;
		}
		this.container.logger.info('Exiting successfully');
	}
}

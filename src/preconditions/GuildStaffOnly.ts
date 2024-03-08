import { Precondition, PreconditionResult } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message, Guild, User } from 'discord.js';
import { getGuildProfileForGuildId } from './../lib/firebase';
import { insufficientPermissionMessageText, internalErrorMessageText } from './../lib/constants';

/**
 * GuildStaffOnlyPrecondition
 *
 * A precondition that only permits guild staff to execute the command.
 */

export class GuildStaffOnlyPrecondition extends Precondition {
	public override async messageRun(message: Message) {
		this.container.logger.debug(`Executing ${this.name}`);
		return await this.evaluatePermissions(message.author, message.guild);
	}

	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		this.container.logger.debug(`Executing ${this.name}`);
		return await this.evaluatePermissions(interaction.user, interaction.guild);
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		this.container.logger.debug(`Executing ${this.name}`);
		return await this.evaluatePermissions(interaction.user, interaction.guild);
	}

	/**
	 * userIsStaff()
	 *
	 * checks if the user of the command is a staff member.
	 */
	private async userIsStaff(user: User, guild: Guild): Promise<boolean> {
		try {
			// get the member in the server where the command was called.
			const member = guild.members.cache.get(user.id);

			// get the guild profile on record.
			const profile = await getGuildProfileForGuildId(guild.id);

			if (profile && member) {
				// check if the member that executed the command is the server owner or has the associated admin role.
				const hasAdminRole = profile.admin_role_id && member.roles.cache.get(profile.admin_role_id) !== undefined;
				const isGuildOwner = member.id === guild.ownerId;
				return hasAdminRole || isGuildOwner;
			} else {
				// the caller is either not a member of the server or the guild has not been setup with our system.
				return false;
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
			throw e;
		}
	}

	/**
	 * evaluatePermissions()
	 *
	 * evaluates the result of the precondition.
	 */
	private async evaluatePermissions(user: User, guild: Guild | null): Promise<PreconditionResult> {
		if (guild) {
			// perform further evaluation.
			try {
				const permitted = await this.userIsStaff(user, guild);
				if (permitted) {
					// the user is permitted.
					this.container.logger.debug(`Permission Granted`);
					return this.ok();
				} else {
					// permission denied.
					this.container.logger.debug(`Permission denied.`);
					return this.error({ message: insufficientPermissionMessageText });
				}
			} catch (e) {
				this.container.logger.debug(`Permission denied due to internal error: ${(e as Error).message} `);
				return this.error({ message: internalErrorMessageText });
			}
		} else {
			// the command was called outside a guild.
			this.container.logger.debug(`Permission denied because command was used outside of a Guild`);
			return this.error({ message: insufficientPermissionMessageText });
		}
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		GuildStaffOnly: never;
	}
}

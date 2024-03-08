import { Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Guild, Message } from 'discord.js';

/**
 * GuildOwnerOnlyPrecondition
 *
 * A precondition that restricts the command to guild owners only.
 */

export class GuildOwnerOnlyPrecondition extends Precondition {
	public override messageRun(message: Message) {
		this.container.logger.debug(`Executing ${this.name}`);
		if (message.author.id === message.guild?.ownerId) {
			this.container.logger.debug(`Permission granted.`);
			return this.ok();
		} else {
			this.container.logger.debug(`Permission denied.`);
			return this.error({
				message: this.formatErrorMessage(message.guild)
			});
		}
	}

	public override chatInputRun(interaction: ChatInputCommandInteraction) {
		this.container.logger.debug(`Executing ${this.name}`);
		if (interaction.user.id === interaction.guild?.ownerId) {
			this.container.logger.debug(`Permission granted.`);
			return this.ok();
		} else {
			this.container.logger.debug(`Permission denied.`);
			return this.error({ message: this.formatErrorMessage(interaction.guild) });
		}
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		this.container.logger.debug(`Executing ${this.name}`);
		if (interaction.user.id === interaction.guild?.ownerId) {
			this.container.logger.debug(`Permission granted.`);
			return this.ok();
		} else {
			this.container.logger.debug(`Permission denied.`);
			return this.error({ message: this.formatErrorMessage(interaction.guild) });
		}
	}

	/**
	 * formatErrorMessage()
	 *
	 * formats the failure message.
	 */
	private formatErrorMessage(guild: Guild | null = null): string {
		return `Sorry, only ${guild ? `<@${guild.ownerId}>` : 'the server owner'} can run this command.`;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		GuildOwnerOnly: never;
	}
}

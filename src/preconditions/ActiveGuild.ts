import { insufficientPermissionMessageText, internalErrorMessageText } from '#lib/constants';
import { getGuildProfileForGuildId } from '#lib/firebase';
import { Precondition, PreconditionResult } from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Guild, Message } from 'discord.js';

/**
 * ActiveGuildPrecondition
 *
 * A precondition that ensures guilds are setup and active in order for a command to run.
 */

export class ActiveGuildPrecondition extends Precondition {
	public override async messageRun(message: Message) {
		return await this.evaluateGuild(message.guild);
	}

	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		return await this.evaluateGuild(interaction.guild);
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return await this.evaluateGuild(interaction.guild);
	}

	private async evaluateGuild(guild: Guild | null): Promise<PreconditionResult> {
		let result = this.error({ message: insufficientPermissionMessageText });
		if (guild) {
			// get the guild profile
			try {
				const profile = await getGuildProfileForGuildId(guild.id);

				if (profile && profile.active) {
					result = this.ok();
				}
			} catch (e) {
				result = this.error({ message: internalErrorMessageText });
			}
		}

		return result;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		ActiveGuild: never;
	}
}

import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS, SSBU_ARENA_INFO_ERROR_TEXT, internalErrorMessageText } from './../lib/constants';
import { getOpenArenasForChannelId } from '#lib/firebase';
import { TextChannel } from 'discord.js';
import { createEmbedForArenaInformation } from '#lib/utils';

/**
 * ArenaInfoCommand
 *
 * Gets thea information for a given channel.
 * @note this command will work even if the guild profile is invalid or not active.
 */

@ApplyOptions<Command.Options>({
	description: 'Shows the arena ID and password',
	name: 'arena',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class ArenaInfoCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{ idHints: ['1214650392072163361'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name}`);
		const caller = interaction.user;
		const guild = interaction.guild!;
		const channel = interaction.channel! as TextChannel;

		try {
			// get the arena.
			this.container.logger.debug('Retrieving arena.');
			const arena = await getOpenArenasForChannelId(channel.id, guild.id);

			if (arena && arena.arena_participants.includes(caller.id)) {
				// show the arena information.
				this.container.logger.debug('Showing arena information...');
				this.container.logger.debug('Exiting successfully');
				return interaction.reply({ embeds: [createEmbedForArenaInformation(arena)] });
			} else {
				// arena not found. Or, caller isn't part of the arena.
				this.container.logger.debug("The arena could not be found. Or, the caller isn't part of the arena.");
				this.container.logger.debug('Exiting successfully');
				return interaction.reply({ content: SSBU_ARENA_INFO_ERROR_TEXT, ephemeral: true });
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
			return interaction.reply({ ephemeral: true, content: internalErrorMessageText });
		}
	}
}

import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS, internalErrorMessageText } from './../lib/constants';
import { TextChannel } from 'discord.js';
import { closeArena, getGuildProfileForGuildId, getOpenArenasForChannelId } from '#lib/firebase';
import { ArenaClosedEventData, BotEvents } from '#lib/events';
import { createEmbedForClosedArena, getLogChannelForGuuildProfile } from '#lib/utils';

/**
 * CloseArenaCommand
 *
 * Closes an Arena.
 */

@ApplyOptions<Command.Options>({
	name: 'close',
	description: 'Closes an arena, ending the game session.',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class CloseArenaCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{ idHints: ['1214651126411038780'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name}`);
		const caller = interaction.user;
		const guild = interaction.guild!;
		const channel = interaction.channel as TextChannel;

		try {
			// get the guild profile
			this.container.logger.debug('Retrieving guild profile.');
			const profile = await getGuildProfileForGuildId(guild.id);

			// get the arena.
			this.container.logger.debug('Retrieving arena information.');
			const arena = await getOpenArenasForChannelId(channel.id, guild.id);

			if (arena && arena.arena_owner === caller.id) {
				// close the arena.
				this.container.logger.debug('Closing the arena.');
				const closedArena = await closeArena(arena);
				// log changes
				if (profile) {
					const logChannel = getLogChannelForGuuildProfile(guild, profile);

					if (logChannel) {
						this.container.logger.debug('Logging changes.');
						await logChannel.send({
							embeds: [createEmbedForClosedArena(closedArena, guild.channels.cache.get(closedArena.arena_channel_id)! as TextChannel)]
						});
					}
				}

				this.container.client.emit(BotEvents.ArenaClosed, <ArenaClosedEventData>{
					arena: closedArena,
					profile: profile
				});

				this.container.logger.debug('Exiting successfully');
				return interaction.reply({ content: 'I have successfully closed the arena. Thanks for playing.' });
			} else {
				// the channel is not an arena channel or the caller isn't the owner.
				this.container.logger.debug('Channel is not an arena channel, or the caller does not own the arena.');
				return interaction.reply({
					ephemeral: true,
					content:
						'Sorry, I was unable to close the arena. This is due to either you are not the arena owner, or this is not an arena channel.'
				});
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
			return interaction.reply({ content: internalErrorMessageText, ephemeral: true });
		}
	}
}

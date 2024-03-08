import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	COMMAND_COOLDOWN_LIMIT,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	SSBU_INVALID_ARENA_INFO_ERROR_TEXT,
	internalErrorMessageText,
	insufficientPermissionMessageText
} from '#lib/constants';
import { createEmbedForArenaInformation, createEmbedForUpdatedArena, getLogChannelForGuuildProfile, validSSBUArenaDetails } from '#lib/utils';
import { TextChannel } from 'discord.js';
import { ArenaInfo, getGuildProfileForGuildId, getOpenArenasForChannelId, updateArena } from '#lib/firebase';
import { DateTime } from 'luxon';
import { ArenaUpdatedEventData, BotEvents } from '#lib/events';

/**
 * SetArenaInfoCommand
 *
 * Updates the arena information.
 */

@ApplyOptions<Command.Options>({
	name: 'setarena',
	description: 'Updates the arena information in an arena channel',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	preconditions: ['ActiveGuild'],
	enabled: true
})
export class SetArenaInfoCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addNumberOption((option) =>
						option
							.setName('size')
							.setDescription('the number of players allowed in the arena')
							.setMinValue(2)
							.setMaxValue(8)
							.setRequired(true)
					)
					.addStringOption((option) => option.setName('arena_id').setDescription('the arena ID').setRequired(true).setMaxLength(5))
					.addStringOption((option) =>
						option.setName('arena_password').setDescription('the arena password, if applicable').setRequired(false).setMaxLength(8)
					),
			{ idHints: ['1214744223308578838'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info('Executing ' + this.name);
		const arenaId: string = interaction.options.get('arena_id')!.value!.toString().trim().toUpperCase();
		const arenaPw: string | null = interaction.options.get('arena_password')?.value?.toString().trim() || null;
		const arenaSize: number = interaction.options.get('size')!.value as number;
		const guild = interaction.guild!;
		const caller = interaction.user;
		const channel = interaction.channel as TextChannel;

		// validate arena details.
		this.container.logger.debug('Validating arena information');
		if (!validSSBUArenaDetails(arenaId, arenaPw)) {
			this.container.logger.debug('Arena information invalid.');
			return interaction.reply({ content: SSBU_INVALID_ARENA_INFO_ERROR_TEXT, ephemeral: true });
		}

		try {
			// get the profile
			this.container.logger.debug('Retrieving profile...');
			const profile = await getGuildProfileForGuildId(guild.id);

			if (!profile) {
				return interaction.reply({ content: insufficientPermissionMessageText, ephemeral: true });
			}

			// get the arena.
			this.container.logger.debug('Retrieving arena informatioin...');
			const arena = await getOpenArenasForChannelId(channel.id, guild.id);

			if (!arena) {
				this.container.logger.debug('Arena not found...');
				return interaction.reply({
					ephemeral: true,
					content: 'Sorry, I cannot update the arena because this is not an arena channel. Please try again in an arena channel.'
				});
			}

			// make sure the caller is the owner is the arena.
			if (arena.arena_owner === caller.id) {
				// make sure the new arena fits everyone curretly in attendance.

				if (arena.arena_current_players > arenaSize) {
					// the new arena is too small.
					this.container.logger.debug('New arena is too small.');
					return interaction.reply({
						ephemeral: true,
						content: `The arena you provided is too small. Please remake it to fit all ${arena.arena_current_players} players here.`
					});
				}

				// update the arena.
				this.container.logger.debug('Updating arena.');
				let updatedArena: ArenaInfo = {
					...arena,
					arena_id: arenaId,
					arena_password: arenaPw,
					arena_size: arenaSize,
					updated_at: DateTime.utc().toJSDate()
				};
				updatedArena = await updateArena(updatedArena);

				// log the changes
				const logChannel = getLogChannelForGuuildProfile(guild, profile!);

				if (logChannel) {
					this.container.logger.debug('Logging changes.');
					await logChannel.send({
						embeds: [createEmbedForUpdatedArena(updatedArena)]
					});
				}

				// emit the event
				this.container.client.emit(BotEvents.ArenaUpdated, <ArenaUpdatedEventData>{
					arena: updatedArena,
					profile: profile
				});
				// return the updated arena.
				this.container.logger.info('Exiting successfully');
				return interaction.reply({
					embeds: [createEmbedForArenaInformation(updatedArena)]
				});
			} else {
				// the caller doesn't own the arena.'
				this.container.logger.debug('Caller does not own the arena.');
				return interaction.reply({
					ephemeral: true,
					content: 'Sorry, you cannot update an arena you do not own.'
				});
			}
		} catch (e) {
			this.container.logger.debug((e as Error).message);
			return interaction.reply({
				ephemeral: true,
				content: internalErrorMessageText
			});
		}
	}
}

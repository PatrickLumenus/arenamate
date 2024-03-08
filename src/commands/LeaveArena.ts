import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
	COMMAND_COOLDOWN_LIMIT,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	internalErrorMessageText,
	insufficientPermissionMessageText
} from './../lib/constants';
import { TextChannel } from 'discord.js';
import { ArenaInfo, getGuildProfileForGuildId, getOpenArenasForChannelId, updateArena } from '#lib/firebase';
import { createEmbedForArenaLeave, getLogChannelForGuuildProfile } from '#lib/utils';
import { ArenaLeaveEventData, BotEvents } from '#lib/events';

/**
 * LeaveArenaCommand
 *
 * Leaves an arena.
 */

@ApplyOptions<Command.Options>({
	name: 'leave',
	description: 'Leave an arena',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	enabled: true
})
export class LeaveArenaCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false),
			{ idHints: ['1214652251344216234'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name}`);
		const user = interaction.user;
		const guild = interaction.guild!;
		const channel = interaction.channel as TextChannel;

		try {
			// get the profile
			this.container.logger.debug(`Retrieving profile...`);
			const profile = await getGuildProfileForGuildId(guild.id);

			if (!profile) {
				this.container.logger.debug(`Profile not found.`);
				return interaction.reply({
					ephemeral: true,
					content: insufficientPermissionMessageText
				});
			}

			// get the arena for the channel.
			this.container.logger.debug(`Getting arena for channel id.`);
			const arena = await getOpenArenasForChannelId(channel.id, guild.id);

			if (!arena) {
				// not an arena channel
				this.container.logger.debug(`Arena not found.`);
				return interaction.reply({
					ephemeral: true,
					content: 'Sorry, this is not an arenas channel. Please try again in an arenas channel.'
				});
			}
			// make sure the user is in that arena.
			if (!arena.arena_participants.includes(user.id)) {
				// user is not part of the arena.
				this.container.logger.debug(`User not part of the arena.`);
				return interaction.reply({
					ephemeral: true,
					content: 'Sorry, you are not a part of this arena.'
				});
			}
			// make sure the user is not the arena owner.
			if (arena.arena_owner === user.id) {
				// the person trying to leave the arena is the owner. Tell them to close it instead.
				this.container.logger.debug(`User is the owner of the arena`);
				return interaction.reply({
					ephemeral: true,
					content: 'Sorry, you cannot leave your own arena. If you are finished with the session, close it instead.'
				});
			}
			// remove the user from the arena.
			this.container.logger.info(`Updating arena`);
			let updatedArena: ArenaInfo = {
				...arena,
				arena_current_players: arena.arena_current_players - 1,
				arena_participants: arena.arena_participants.filter((p) => p !== user.id)
			};
			updatedArena = await updateArena(updatedArena);
			// log changes
			const logChannel = getLogChannelForGuuildProfile(guild, profile);

			if (logChannel) {
				this.container.logger.debug(`Logging changes...`);
				await logChannel.send({
					embeds: [createEmbedForArenaLeave(arena, user)]
				});
			}

			this.container.client.emit(BotEvents.ArenaLeave, <ArenaLeaveEventData>{
				arena: updatedArena,
				profile: profile,
				user: user
			});

			this.container.logger.info(`Exiting successfully`);
			return interaction.reply({
				content: `You have successfully left the arena.`,
				ephemeral: true
			});
		} catch (e) {
			this.container.logger.error((e as Error).message);
			return interaction.reply({
				ephemeral: true,
				content: internalErrorMessageText
			});
		}
	}
}

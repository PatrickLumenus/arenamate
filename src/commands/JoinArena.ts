import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
	COMMAND_COOLDOWN_LIMIT,
	COMMAND_COOLDOWN_DURATION_IN_MS,
	insufficientPermissionMessageText,
	internalErrorMessageText
} from './../lib/constants';
import { ArenaInfo, getGuildProfileForGuildId, getOpenArenasForUserId, updateArena } from '#lib/firebase';
import { Guild, User } from 'discord.js';
import { channelMention } from 'discord.js';
import { userMention } from 'discord.js';
import { createEmbedForArenaJoin, getLogChannelForGuuildProfile } from '#lib/utils';
import { ArenaJoinEventData, BotEvents } from '#lib/events';

@ApplyOptions<Command.Options>({
	name: 'join',
	description: 'Joins an open arena',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	preconditions: ['ActiveGuild'],
	enabled: true
})
export class JoinArenaCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addUserOption((option) =>
						option.setName('arena_owner').setDescription('The owner of the arena you want to join').setRequired(true)
					),
			{ idHints: ['1214651938570764419'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = interaction.guild!;
		const user = interaction.user;
		const arenaOwner = interaction.options.get('arena_owner', true).user!;

		try {
			// get the profile
			this.container.logger.debug('Getting profile');
			const profile = await getGuildProfileForGuildId(guild.id);

			if (!profile) {
				this.container.logger.debug('Profile not found.');
				return interaction.reply({
					ephemeral: true,
					content: insufficientPermissionMessageText
				});
			}

			// make sure the user isn't already in an arena.
			this.container.logger.debug('Checking if caller is already in an arena.');
			const existingOpenArena = await this.getExistingArenaForUserInGuild(user, guild);

			if (existingOpenArena) {
				this.container.logger.debug('Caller already in an arena.');
				return interaction.reply({
					ephemeral: true,
					content: `Sorry, you can't join this arena because you are already in an open arena in ${channelMention(existingOpenArena.arena_channel_id)}. Please close or leave that arena before joining this one.`
				});
			}

			// get the the arena
			this.container.logger.debug('Getting arena to join.');
			const arenaToJoin = await this.getExistingArenaForUserInGuild(arenaOwner, guild);

			if (arenaToJoin) {
				// make sure the arena has space.
				this.container.logger.debug('Verifying arena');
				if (arenaToJoin.arena_current_players < arenaToJoin.arena_size) {
					// add the player to the arena.
					this.container.logger.debug('Adding user to arena.');
					let updatedArena: ArenaInfo = {
						...arenaToJoin,
						arena_current_players: arenaToJoin.arena_current_players + 1,
						arena_participants: [...arenaToJoin.arena_participants, user.id]
					};

					// save the changes
					updatedArena = await updateArena(updatedArena);

					// log changes
					const logChannel = getLogChannelForGuuildProfile(guild, profile);

					if (logChannel) {
						this.container.logger.debug('Logging changes');
						await logChannel.send({
							embeds: [createEmbedForArenaJoin(updatedArena, user)]
						});
					}

					// emit the event.
					this.container.client.emit(BotEvents.ArenaJoin, <ArenaJoinEventData>{
						profile: profile,
						user: user,
						arena: updatedArena
					});

					this.container.logger.debug('Exiting successfully');
					return interaction.reply({
						ephemeral: true,
						content: `Great news. You have successfully joined ${userMention(updatedArena.arena_owner)}${arenaOwner.displayName.toLowerCase().endsWith('s') ? "'s" : "'"} arena. I have mentioned you in the arena channel.`
					});
				} else {
					// arena has no space.
					return interaction.reply({
						ephemeral: true,
						content: "Sorry, you can't join that arena because it is full. Try joining a different one or create your own."
					});
				}
				// add the user to the arena.
				// save changes.
			} else {
				// arena not found.
				return interaction.reply({
					ephemeral: true,
					content: `Sorry, I couln't find an open arena from ${userMention(arenaOwner.id)}`
				});
			}
		} catch (e) {
			return interaction.reply({
				ephemeral: true,
				content: internalErrorMessageText
			});
		}
	}

	private async getExistingArenaForUserInGuild(user: User, guild: Guild): Promise<ArenaInfo | null> {
		let arenas = await getOpenArenasForUserId(user.id);
		arenas = arenas.filter((arena) => {
			return arena.guild_id === guild.id;
		});
		return arenas.length ? arenas[0] : null;
	}
}

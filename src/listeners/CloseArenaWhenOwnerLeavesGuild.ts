import { ApplyOptions } from '@sapphire/decorators';
import { Listener, Events } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { retry } from '@sapphire/utilities';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaInfo, closeArena, getGuildProfileForGuildId, getOpenArenasForUserId, updateArena } from '#lib/firebase';
import { ArenaClosedEventData, ArenaLeaveEventData, BotEvents } from '#lib/events';
import { createEmbedForArenaLeave, createEmbedForClosedArena, getLogChannelForGuuildProfile } from '#lib/utils';
import { TextChannel } from 'discord.js';

/**
 * CloseArenaWhenOwnerLeavesGuildListener
 *
 * automatically closes an arena when the owner leaves
 */

@ApplyOptions<Listener.Options>({
	name: 'close-arena-when-owner-leaves-guild',
	event: Events.GuildMemberRemove,
	enabled: true
})
export class UserEvent extends Listener {
	public override async run(member: GuildMember) {
		this.container.logger.info(`Executing ${this.name}`);
		const guild = member.guild;

		try {
			// get the profile
			this.container.logger.debug('Retriving profile');
			const profile = await retry(async () => {
				return await getGuildProfileForGuildId(guild.id);
			}, MAX_RETRY_ATTEMPTS);

			if (profile) {
				// close any arenas that the member owns. Or, remove him from ones he is in.
				// get the arena for a user.
				this.container.logger.debug('Retrieving arena');
				const arena = await retry(async () => {
					let result = await getOpenArenasForUserId(member.id);
					result = result.filter((arena) => arena.guild_id === guild.id);
					return result.length > 0 ? result[0] : null;
				}, MAX_RETRY_ATTEMPTS);

				if (arena) {
					// remove the user from the arena.
					if (arena.arena_owner == member.id) {
						// we need to close the arena.
						this.container.logger.debug('Closing arena');
						const closedArena = await retry(async () => {
							return await closeArena(arena);
						}, MAX_RETRY_ATTEMPTS);
						await retry(async () => {
							// log changes
							const logChannel = getLogChannelForGuuildProfile(guild, profile);
							const closedArenaChannel = guild.channels.cache.get(closedArena.arena_channel_id)! as TextChannel;
							if (logChannel) {
								this.container.logger.debug('Logging changes');
								await logChannel.send({
									embeds: [createEmbedForClosedArena(closedArena, closedArenaChannel)]
								});
							}
						}, MAX_RETRY_ATTEMPTS);
						// emit the event.
						this.container.logger.debug('Emitting event.');
						this.container.client.emit(BotEvents.ArenaClosed, <ArenaClosedEventData>{
							arena: closedArena,
							profile: profile
						});
						this.container.logger.debug('Arena successfully deleted.');
					} else {
						// we just need to remove the member from the arena.
						this.container.logger.debug('Removing member from arena.');
						const updatedArena = await retry(async () => {
							const updatedArena: ArenaInfo = {
								...arena,
								arena_current_players: arena.arena_current_players - 1,
								arena_participants: arena.arena_participants.filter((p) => p !== member.id)
							};
							return await updateArena(updatedArena);
						}, MAX_RETRY_ATTEMPTS);
						// log the changes
						await retry(async () => {
							const logChannel = getLogChannelForGuuildProfile(guild, profile);

							if (logChannel) {
								this.container.logger.debug('Logging changes');
								await logChannel.send({
									embeds: [createEmbedForArenaLeave(updatedArena, member.user)]
								});
							}
						}, MAX_RETRY_ATTEMPTS);
						// emit the event.
						this.container.logger.debug('Emitting event.');
						this.container.client.emit(BotEvents.ArenaLeave, <ArenaLeaveEventData>{
							profile,
							arena: updatedArena,
							user: member.user
						});
						this.container.logger.debug('Member successfuly removed from arena.');
					}
				} else {
					// no action necessary.
					this.container.logger.debug('No action necessary');
				}
			} else {
				// guild not set up. So, there aren't any arenas here.
				this.container.logger.debug('No action necessary');
			}
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
		this.container.logger.info('Exiting successfully');
	}
}

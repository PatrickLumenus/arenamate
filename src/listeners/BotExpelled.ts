import { ApplyOptions } from '@sapphire/decorators';
import { Listener, Events } from '@sapphire/framework';
import { retry } from '@sapphire/utilities';
import { Guild } from 'discord.js';
import { getGuildProfileForGuildId, deleteGuildProfile } from './../lib/firebase';
import { MAX_RETRY_ATTEMPTS } from '#lib/constants';

/**
 * BotExpelledEventListener
 *
 * A listener that deletes the guild profile if the bot is expelled from the server.
 */

@ApplyOptions<Listener.Options>({
	name: 'bot-expelled',
	event: Events.GuildDelete
})
export class BotExpelledEventListener extends Listener {
	public override async run(guild: Guild) {
		this.container.logger.info(`Executing ${this.name}`);
		try {
			this.container.logger.debug('Retrieving guild profile.');
			const profile = await retry(async () => {
				return await getGuildProfileForGuildId(guild.id);
			}, MAX_RETRY_ATTEMPTS);

			if (profile) {
				// delete the profile;
				await retry(async () => await deleteGuildProfile(profile), MAX_RETRY_ATTEMPTS);
			} else {
				this.container.logger.debug('Profile not found.');
			}
		} catch (e) {
			// an error has occured.
			this.container.logger.error((e as Error).message);
		}
		this.container.logger.info('Exiting successfully.');
	}
}

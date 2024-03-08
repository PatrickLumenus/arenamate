import { MAX_RETRY_ATTEMPTS } from '#lib/constants';
import { ArenaForceCloseEventData, BotEvents } from '#lib/events';
import { closeArenasExceedingTimeInHours } from '#lib/firebase';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { retry } from '@sapphire/utilities';

/**
 * ForceCloseArenaTasks
 *
 * A CRON job that force closes all arenas that are open for more than 8 hours.
 */

export class ForceCloseArenaTask extends ScheduledTask {
	public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'force-close-arenas-task',
			pattern: '0 */8 * * *' // every 8 hours
		});
	}

	public async run() {
		this.container.logger.info(`Executing ${this.name}`);
		try {
			const closedArenas = await retry(async () => {
				return await closeArenasExceedingTimeInHours(8);
			}, MAX_RETRY_ATTEMPTS);
			this.container.logger.debug(`Force closed ${closedArenas.length} arenas.`);

			this.container.logger.debug('Emitting events.');
			closedArenas.forEach((arena) => {
				this.container.client.emit(BotEvents.ArenaForceClosed, <ArenaForceCloseEventData>{
					arena: arena
				});
			});
			this.container.logger.info('Exiting successfully');
		} catch (e) {
			this.container.logger.error((e as Error).message);
		}
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		pattern: never;
	}
}

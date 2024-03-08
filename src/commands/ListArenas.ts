import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS, internalErrorMessageText } from './../lib/constants';
import { getJoinableOpenArenas } from '#lib/firebase';
import { createEmbedForArenasSearchResults } from '#lib/utils';

@ApplyOptions<Command.Options>({
	name: 'arenas',
	description: 'Finds at most 5 open arenas you can join.',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	preconditions: ['ActiveGuild'],
	enabled: true
})
export class ListArenasCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{ idHints: ['1214652622922063882'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		this.container.logger.info('Executing ' + this.name);
		const guild = interaction.guild!;
		try {
			this.container.logger.debug('Searching for arenas...');
			const arenas = await getJoinableOpenArenas(guild.id);
			this.container.logger.debug('Arenas Found: ' + arenas.length);
			this.container.logger.debug('Exiting successfully');
			return interaction.reply({
				ephemeral: true,
				embeds: [createEmbedForArenasSearchResults(arenas)]
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

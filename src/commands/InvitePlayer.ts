import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { COMMAND_COOLDOWN_LIMIT, COMMAND_COOLDOWN_DURATION_IN_MS } from './../lib/constants';

@ApplyOptions<Command.Options>({
	name: 'invite',
	description: 'Invite a user to the arena you are in.',
	cooldownDelay: COMMAND_COOLDOWN_DURATION_IN_MS,
	cooldownLimit: COMMAND_COOLDOWN_LIMIT,
	preconditions: ['ActiveGuild'],
	enabled: false
})
export class InvitePlayerCommand extends Command {
	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description),
			{ idHints: ['1214651508138840164'] }
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		// return interaction.reply({ content: 'Hello world!' });
		throw new Error('Command Not Defined');
	}
}

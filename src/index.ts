import './lib/setup';
import '@sapphire/plugin-scheduled-tasks/register';

import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';

const client = new SapphireClient({
	defaultPrefix: '$',
	regexPrefix: /^(hey +)?bot[,\$ ]/i,
	caseInsensitiveCommands: true,
	logger: {
		level: LogLevel.Debug
	},
	shards: 'auto',
	// see https://discord.com/developers/docs/topics/gateway#list-of-intents
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
	partials: [Partials.Channel],
	loadMessageCommandListeners: true,
	tasks: {
		bull: {
			connection: {
				host: process.env.REDIS_HOST,
				port: parseInt(process.env.REDIS_PORT || '6379'),
				username: process.env.REDIS_USERNAME,
				password: process.env.REDIS_PASSWORD
			}
		}
	}
});

const main = async () => {
	try {
		client.logger.info('Logging in');
		await client.login(process.env.DISCORD_TOKEN);
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		await client.destroy();
		process.exit(1);
	}
};

void main();

import { PermissionsBitField } from 'discord.js';
import { join } from 'path';

// Sapphire constants.
export const rootDir = join(__dirname, '..', '..');
export const srcDir = join(rootDir, 'src');
export const RandomLoadingMessage = ['Computing...', 'Thinking...', 'Cooking some food', 'Give me a moment', 'Loading...'];

// Custom constants.
export const UNSET = '<not set>';
export const COMMAND_COOLDOWN_DURATION_IN_MS: number = 5000;
export const COMMAND_COOLDOWN_LIMIT: number = 3;
export const DEFAULT_ARENAS_CATEGORY_NAME = 'ArenaMate Arenas';
export const DEFAULT_ADMIN_ROLE_NAME = 'ArenaMate Admin';
export const embedSignatureText = 'Powered by Valiant Guilds';
export const internalErrorMessageText = 'Sorry, something went wrong. Please try again in a little bit. If this persists, contact support.';
export const insufficientPermissionMessageText = 'Sorry, you do not have the permissions to use this command.';
export const ARENA_CHANNEL_PLAYER_PERMISSIONS = [
	PermissionsBitField.Flags.ViewChannel,
	PermissionsBitField.Flags.SendMessages,
	PermissionsBitField.Flags.ReadMessageHistory,
	PermissionsBitField.Flags.AddReactions,
	PermissionsBitField.Flags.UseApplicationCommands
];
export const ARENA_CATEGORY_USER_PERMISSIONS = [];
export const ARENA_CATEGORY_ADMIN_PERMISSIONS = [...ARENA_CHANNEL_PLAYER_PERMISSIONS, PermissionsBitField.Flags.ManageChannels];
export const MAX_RETRY_ATTEMPTS = 5;

// SSBU specific constants
export const SSBU_INVALID_ARENA_INFO_ERROR_TEXT = 'Sorry, I could not create your arena because the arena information you provided is invalid.';
export const SSBU_ARENA_INFO_ERROR_TEXT =
	"Sorry, I cannot show you the arena information bevause this channel isn't an arena channel or you are not part of this arena. Please try again in an arena channel. Or, join this arena.";

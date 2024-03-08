// Import the functions you need from the SDKs you need
import { container } from '@sapphire/framework';
import { initializeApp } from 'firebase/app';
import {
	DocumentData,
	DocumentReference,
	and,
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	limit,
	or,
	orderBy,
	query,
	runTransaction,
	where,
	writeBatch
} from 'firebase/firestore';
import { DateTime } from 'luxon';

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: process.env.FIREBASE_API_KEY,
	authDomain: process.env.FIREBASE_AUTH_DOMAIN,
	projectId: process.env.FIREBASE_PROJECT_ID,
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const database = db;

export interface GuildProfile {
	readonly guild_id: string;
	readonly owner_id: string;
	readonly arenas_category_id: string | null;
	readonly admin_role_id: string | null;
	readonly log_channel_id: string | null;
	readonly active: boolean;
	readonly created_at: Date;
	readonly updated_at: Date;
	readonly deleted_at: Date | null;
}

export interface ArenaInfo {
	readonly id: string;
	readonly arena_id: string;
	readonly arena_password: string | null;
	readonly arena_owner: string;
	readonly arena_size: number;
	readonly private: boolean;
	readonly fill_rate: number | null;
	readonly arena_current_players: number;
	readonly arena_participants: string[];
	readonly arena_channel_id: string;
	readonly guild_id: string;
	readonly created_at: Date;
	readonly closed_at: Date | null;
	readonly updated_at: Date;
}

export enum Collections {
	GuildProfiles = 'guild_profiles',
	Arenas = 'arenas'
}

export class DatabaseException extends Error {
	constructor(message: string = 'An error has occured') {
		super(message);
	}
}

export class DatabaseConflictException extends DatabaseException {
	constructor(message: string = 'Record already exists.') {
		super(message);
	}
}

export class RecordNotFoundException extends DatabaseException {
	constructor(message: string = 'Record not found.') {
		super(message);
	}
}

/**
 * getGuildProfileforGuildId()
 *
 * gets a guild profile for its guild id.
 * @returns the GuildProfile or null if its not found.
 * @throws DatabaseException if an error occurs.
 */
export const getGuildProfileForGuildId = async (id: string): Promise<GuildProfile | null> => {
	try {
		const profileRef = doc(database, Collections.GuildProfiles, id);
		const profile = await getDoc(profileRef);
		let result: GuildProfile | null = null;

		if (profile.exists()) {
			const data = profile.data();
			result = {
				guild_id: profile.id,
				active: data.active,
				arenas_category_id: data.arenas_category_id,
				log_channel_id: data.log_channel_id,
				admin_role_id: data.admin_role_id,
				owner_id: data.owner_id,
				created_at: data.created_at,
				updated_at: data.updated_at,
				deleted_at: data.deleted_at
			};
		}
		return result && !result.deleted_at ? result : null;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * createGuildProfile()
 *
 * creates a guild profile
 * @returns the GuildProfile or null if its not found.
 * @throws DatabaseException if an error occurs.
 * @throws DatabaseConflictException when the record already exists.
 */

export const createGuildProfile = async (profile: GuildProfile): Promise<GuildProfile> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const profileRef = doc(database, Collections.GuildProfiles, profile.guild_id);

			const record = await transaction.get(profileRef);

			if (record.exists()) {
				throw new DatabaseConflictException();
			}

			const now = DateTime.utc().toJSDate();
			const data: GuildProfile = {
				...profile,
				created_at: now,
				updated_at: now
			};
			transaction.set(profileRef, data);
			return data;
		});
	} catch (e) {
		const error = e as Error;

		if (error instanceof DatabaseConflictException) {
			throw e;
		} else {
			throw new DatabaseException(error.message);
		}
	}
};

/**
 * updateGuildProfile()
 *
 * updates a guild profile
 * @returns the GuildProfile or null if its not found.
 * @throws DatabaseException if an error occurs.
 * @throws RecordNotFoundException when the record isn't found..
 */

export const updateGuildProfile = async (profile: GuildProfile): Promise<GuildProfile> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const profileRef = doc(database, Collections.GuildProfiles, profile.guild_id);

			const record = await transaction.get(profileRef);

			if (!record.exists()) {
				throw new RecordNotFoundException();
			}

			const data: GuildProfile = {
				...profile,
				updated_at: DateTime.utc().toJSDate()
			};
			transaction.set(profileRef, data);
			return data;
		});
	} catch (e) {
		const error = e as Error;

		if (error instanceof RecordNotFoundException) {
			throw e;
		} else {
			throw new DatabaseException(error.message);
		}
	}
};

export const deleteGuildProfile = async (profile: GuildProfile): Promise<GuildProfile> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const profileRef = doc(database, Collections.GuildProfiles, profile.guild_id);
			const record = await transaction.get(profileRef);

			const now = DateTime.utc().toJSDate();
			const data: GuildProfile = {
				...profile,
				deleted_at: now
			};
			if (record.exists()) {
				transaction.set(profileRef, data);
			}
			return data;
		});
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * createArena()
 *
 * creates a new arena record.
 * @returns the created arena.
 * @throws DatabaseConflictException when there is already an existing arena.
 * @throws DatabaseException when there is a database error.
 */

export const createArena = async (arena: ArenaInfo): Promise<ArenaInfo> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const recordRef = doc(database, Collections.Arenas, arena.id);

			// make sure the record does not already exist.
			const record = await transaction.get(recordRef);
			if (record.exists()) {
				throw new DatabaseConflictException();
			}

			// create the record.
			const now = DateTime.utc().toJSDate();
			const data: ArenaInfo = {
				...arena,
				fill_rate: arena.arena_current_players / arena.arena_size || 0.0,
				created_at: now,
				updated_at: now,
				closed_at: null
			};
			transaction.set(recordRef, data);
			return data;
		});
	} catch (e) {
		if (e instanceof DatabaseConflictException) {
			throw e;
		}
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * getOpenArenasForUserId()
 *
 * gets the open arenas for a given user ID.
 * @note this method will return all the open arenas the user is in, regardless of the guild. If you wish
 * to only return the arenas in a specific guild, you will need to further filter the results.
 * @returns an array of arenas the user ID owns or is part of.
 * @throws DatabaseException when the operation fails.
 */

export const getOpenArenasForUserId = async (uid: string): Promise<ArenaInfo[]> => {
	try {
		const collectionRef = collection(database, Collections.Arenas);
		const userArenaQuery = query(
			collectionRef,
			and(where('closed_at', '==', null), or(where('arena_owner', '==', uid), where('arena_participants', 'array-contains', uid)))
		);
		const results = await getDocs(userArenaQuery);
		let data: DocumentData;
		const arenas: ArenaInfo[] = [];
		results.forEach((doc) => {
			data = doc.data();
			arenas.push({
				id: doc.id,
				arena_channel_id: data.arena_channel_id,
				arena_id: data.arena_id,
				arena_password: data.arena_password,
				arena_owner: data.arena_owner,
				arena_current_players: data.arena_current_players,
				arena_participants: data.arena_participants,
				arena_size: data.arena_size,
				private: data.private,
				fill_rate: data.fill_rate,
				guild_id: data.guild_id,
				closed_at: data.closed_at,
				created_at: data.created_at,
				updated_at: data.updated_at
			});
		});
		return arenas;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * getOpenArenasForGuild
 *
 * gets all the currently open arenas for a guild.
 * @returns ArenaInfo[] containing the open arenas.
 * @throws DatabaseException when the database throws an error.
 */
export const getOpenArenasForGuild = async (gid: string): Promise<ArenaInfo[]> => {
	try {
		const collectionRef = collection(database, Collections.Arenas);
		const userArenaQuery = query(collectionRef, and(where('closed_at', '==', null), where('guild_id', '==', gid)));
		const results = await getDocs(userArenaQuery);
		let data: DocumentData;
		const arenas: ArenaInfo[] = [];
		results.forEach((doc) => {
			data = doc.data();
			arenas.push({
				id: doc.id,
				arena_channel_id: data.arena_channel_id,
				arena_id: data.arena_id,
				arena_password: data.arena_password,
				arena_owner: data.arena_owner,
				arena_current_players: data.arena_current_players,
				arena_participants: data.arena_participants,
				arena_size: data.arena_size,
				private: data.private,
				fill_rate: data.fill_rate,
				guild_id: data.guild_id,
				closed_at: data.closed_at,
				created_at: data.created_at,
				updated_at: data.updated_at
			});
		});
		return arenas;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * getJoinableOpenArenas()
 *
 * gets a list of open arenas that can be joined, ordered from the least full to the most full.
 * @param count the maximum number of arenas to retrieve.
 * @param gid the id of the guild to search in.
 * @throws DatabaseException when the operation fails.
 */

export const getJoinableOpenArenas = async (gid: string, count: number = 5): Promise<ArenaInfo[]> => {
	try {
		const collectionRef = collection(database, Collections.Arenas);
		const userArenaQuery = query(
			collectionRef,
			and(where('guild_id', '==', gid), where('closed_at', '==', null), where('fill_rate', '<', 1.0)),
			limit(count),
			orderBy('fill_rate', 'asc')
		);
		const results = await getDocs(userArenaQuery);
		let data: DocumentData;
		const arenas: ArenaInfo[] = [];
		results.forEach((doc) => {
			data = doc.data();
			arenas.push({
				id: doc.id,
				arena_channel_id: data.arena_channel_id,
				arena_id: data.arena_id,
				arena_password: data.arena_password,
				arena_owner: data.arena_owner,
				arena_current_players: data.arena_current_players,
				arena_participants: data.arena_participants,
				arena_size: data.arena_size,
				private: data.private,
				fill_rate: data.fill_rate,
				guild_id: data.guild_id,
				closed_at: data.closed_at,
				created_at: data.created_at,
				updated_at: data.updated_at
			});
		});
		return arenas;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * getOpenArenasForChanelId()
 *
 * gets the open arenas for a given user ID.
 * @param cid is the channel id.
 * @param gid is the guild id.
 * @returns the ArenaInfo instance associated with the channel id and guild id. Or, null if it is not found.
 * @throws DatabaseException when the operation fails.
 */

export const getOpenArenasForChannelId = async (cid: string, gid: string): Promise<ArenaInfo | null> => {
	try {
		const collectionRef = collection(database, Collections.Arenas);
		const userArenaQuery = query(
			collectionRef,
			and(where('arena_channel_id', '==', cid), where('closed_at', '==', null), where('guild_id', '==', gid))
		);
		const results = await getDocs(userArenaQuery);
		let data: DocumentData;
		const arenas: ArenaInfo[] = [];
		results.forEach((doc) => {
			data = doc.data();
			arenas.push({
				id: doc.id,
				arena_channel_id: data.arena_channel_id,
				arena_id: data.arena_id,
				arena_password: data.arena_password,
				arena_owner: data.arena_owner,
				arena_current_players: data.arena_current_players,
				arena_participants: data.arena_participants,
				arena_size: data.arena_size,
				guild_id: data.guild_id,
				fill_rate: data.fill_rate,
				private: data.private,
				closed_at: data.closed_at,
				created_at: data.created_at,
				updated_at: data.updated_at
			});
		});
		return arenas.length > 0 ? arenas[0] : null;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * getOpenArenasForMinimumDuration()
 *
 * gets open arenas that have been open for the specified minimum duration.
 * @param hours the minimum duration in hours.
 * @returns an array of ArenaInfo instances that have been opened for the specified period.
 */

export const getOpenArenasForMinimumDuration = async (hours: number): Promise<ArenaInfo[]> => {
	try {
		const collectionRef = collection(database, Collections.Arenas);
		const cutoffDate = DateTime.utc().minus({ hours: hours });
		const userArenaQuery = query(collectionRef, and(where('closed_at', '==', null), where('created_at', '<=', cutoffDate.toJSDate())));
		const results = await getDocs(userArenaQuery);
		let data: DocumentData;
		const arenas: ArenaInfo[] = [];
		results.forEach((doc) => {
			data = doc.data();
			arenas.push({
				id: doc.id,
				arena_channel_id: data.arena_channel_id,
				arena_id: data.arena_id,
				arena_password: data.arena_password,
				arena_owner: data.arena_owner,
				arena_current_players: data.arena_current_players,
				arena_participants: data.arena_participants,
				arena_size: data.arena_size,
				guild_id: data.guild_id,
				fill_rate: data.fill_rate,
				private: data.private,
				closed_at: data.closed_at,
				created_at: data.created_at,
				updated_at: data.updated_at
			});
		});
		return arenas;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * upsateArena()
 *
 * updates the arena.
 * @returns the updated arena
 * @throws RecordNotFoundException when the arena record isn't found
 * @throws DatabaseException when the database throws an error.
 */

export const updateArena = async (arena: ArenaInfo): Promise<ArenaInfo> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const recordRef = doc(database, Collections.Arenas, arena.id);

			// make sure the record exitsts
			const record = await transaction.get(recordRef);
			if (!record.exists()) {
				throw new RecordNotFoundException();
			}

			// create the record.
			const data: ArenaInfo = {
				...arena,
				fill_rate: arena.arena_current_players / arena.arena_size || 0.0,
				updated_at: DateTime.utc().toJSDate()
			};
			transaction.set(recordRef, data);
			return data;
		});
	} catch (e) {
		if (e instanceof RecordNotFoundException) {
			throw e;
		}
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * closeArena()
 *
 * closes an arena.
 * @returns the closed arena.
 * @throws RecordNotFoundException when the arena recod isn't found.
 * @throws DatabaseException when the operation fails.
 */

export const closeArena = async (arena: ArenaInfo): Promise<ArenaInfo> => {
	try {
		return await runTransaction(database, async (transaction) => {
			const recordRef = doc(database, Collections.Arenas, arena.id);

			// make sure the record does not already exist.
			const record = await transaction.get(recordRef);
			if (!record.exists()) {
				throw new RecordNotFoundException();
			}

			// delete the record (as in add a closed_at property value.)
			const now = DateTime.utc().toJSDate();
			const updatedArena: ArenaInfo = {
				...arena,
				closed_at: now,
				updated_at: now
			};
			transaction.set(recordRef, updatedArena);
			return updatedArena;
		});
	} catch (e) {
		if (e instanceof RecordNotFoundException) {
			throw e;
		}
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * closeArenasExceedingTimeInHours()
 *
 * closes all arenas exceeding time in hours.
 */

export const closeArenasExceedingTimeInHours = async (hrs: number = 6): Promise<ArenaInfo[]> => {
	try {
		const arenasToClose = await getOpenArenasForMinimumDuration(hrs);
		const now = DateTime.utc().toJSDate();
		const closedArenas: ArenaInfo[] = arenasToClose.map((arena) => {
			return {
				...arena,
				closed_at: now,
				updated_at: now
			};
		});
		if (closedArenas.length > 0) {
			const batch = writeBatch(database);
			let ref: DocumentReference<DocumentData, DocumentData>;
			let num = 0;
			closedArenas.forEach((closedArena) => {
				ref = doc(database, Collections.Arenas, closedArena.id);
				batch.set(ref, closedArena);
				num++;
			});
			await batch.commit();
			container.logger.debug(`Force closed ${num} arenas.`);
		}

		container.logger.debug(`Returning ${closedArenas.length} arenas.`);
		return closedArenas;
	} catch (e) {
		// an error occured.
		throw new DatabaseException((e as Error).message);
	}
};

/**
 * forceCloseOpenArenasForGuild()
 *
 * force closes all guild arenas.
 */
export const forceCloseOpenArenasForGuild = async (gid: string) => {
	try {
		const openArenas = await getOpenArenasForGuild(gid);
		let closedArenas: ArenaInfo[] = [];

		if (openArenas.length) {
			const batch = writeBatch(database);
			let ref: DocumentReference<DocumentData, DocumentData>;
			let updatedArena: ArenaInfo;
			const now = DateTime.utc().toJSDate();
			openArenas.forEach((arena) => {
				ref = doc(database, Collections.Arenas, arena.id);
				updatedArena = {
					...arena,
					closed_at: now
				};
				batch.set(ref, updatedArena);
				closedArenas.push(updatedArena);
			});
			await batch.commit();
		}
		return closedArenas;
	} catch (e) {
		throw new DatabaseException((e as Error).message);
	}
};

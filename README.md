# ArenaMate Bot

ArenaMate is a Discord bot that can manage Super Smash Bros. Ultimate arenas within servers. ArenaMate removes the need to search endless walls of text for Smash Bros. Ultimate arena codes. Instead, your members will be able to search the bot for open arenas to join, and even create their own for others to join.

## Setup

Follow these instructions to setup your own instance of ArenaMate.

### Required Permissions

The following permissions are required for ArenaMate to function properly.

-   Manage Server: The bot needs permissions to create a category dedicated to arenas.
-   Manage Roles: The bot will use this permission to create a dedicated Arenas Admin role which will allow whoever has it to run administration commands.
-   Manage Channels: The bot will use this permissions to create arena channels.
-   Send Messages: This permission is used to send log messages and other necessary messages to inform users.

### Setting Your Bot Token and Owners

To set your bot token, specify it in the `DISCORD_TOKEN` environment variable. Optionally, you can also specify the ID of the bot owner in the `OWNERS` environment variable.

### Firebase

ArenaMate uses Firebase to store information regarding guilds and arenas. In order to set firebase up, you will need to specify the following Environment Variables. You should be able to get these values from your Firestore Project page.

-   `FIREBASE_API_KEY`
-   `FIREBASE_AUTH_DOMAIN`
-   `FIREBASE_PROJECT_ID`
-   `FIREBASE_STORAGE_BUCKET`
-   `FIREBASE_MESSAGING_SENDER_ID`
-   `FIREBASE_APP_ID`

In order to run arena search operations, you will also need to index the following in the `arenas` collection:

-   `closed_at`: Ascending
-   `guild_id`: Ascending
-   `fill_rate`: Ascending,
-   `_name_`: Ascending

### Redis

ArenaMate uses Redis to run scheduled tasks. You will need to provide the following Environment Variables for ArenaMate to connect to your Redis Database.

TODO

## Starting ArenaMate

To start, ArenaMate, follow the below instructions.

## Install

ArenaMate requires NodeJS v18 or newer. To install dependencies, run the follwoing command.

```sh
npm install
```

### Starting ArenaMate

Once the dependencies have been installed, you can run ArenaMate using the following command.

```sh
npm run start
```

## License

ArenaMate is provided to you under the [MIT License](./../LICENSE)

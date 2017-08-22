const { Client, Util } = require('discord.js');
const { TOKEN, PREFIX } = require('./config');
const ytdl = require('ytdl-core');

const client = new Client({ disableEveryone: true });

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Yo this ready!'));

client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconect now...'));

client.on('reconnecting', () => console.log('I am reconnecting now!'));

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;
	const args = msg.content.split(' ');
	const serverQueue = queue.get(msg.guild.id);

	if (msg.content.startsWith(`${PREFIX}play`)) {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('I\'m sorry but you need to be in a voice channel to play music!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('I cannot connect to your voice channel, make sure I have the proper permissions!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('I cannot speak in this voice channel, make sure I have the proper permissions!');
		}

		const songInfo = await ytdl.getInfo(args[1]);
		const song = {
			title: Util.escapeMarkdown(songInfo.title),
			url: songInfo.video_url
		};
		if (!serverQueue) {
			const queueConstruct = {
				textChannel: msg.channel,
				voiceChannel: voiceChannel,
				connection: null,
				songs: [],
				volume: 5,
				playing: true
			};
			queue.set(msg.guild.id, queueConstruct);

			queueConstruct.songs.push(song);

			try {
				var connection = await voiceChannel.join();
				queueConstruct.connection = connection;
				play(msg.guild, queueConstruct.songs[0]);
			} catch (error) {
				console.error(`I could not join the voice channel: ${error}`);
				queue.delete(msg.guild.id);
				return msg.channel.send(`I could not join the voice channel: ${error}`);
			}
		} else {
			serverQueue.songs.push(song);
			console.log(serverQueue.songs);
			return msg.channel.send(`**${song.title}** has been added to the queue!`);
		}
		return undefined;
	} else if (msg.content.startsWith(`${PREFIX}skip`)) {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing that I could skip for you.');
		serverQueue.connection.dispatcher.end();
		return undefined;
	} else if (msg.content.startsWith(`${PREFIX}stop`)) {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing that I could stop for you.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end();
		return undefined;
	} else if (msg.content.startsWith(`${PREFIX}volume`)) {
		if (!msg.member.voiceChannel) return msg.channel.send('You are not in a voice channel!');
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		if (!args[1]) return msg.channel.send(`The current volume is: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`I set the volume to: **${args[1]}**`);
	} else if (msg.content.startsWith(`${PREFIX}np`)) {
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		return msg.channel.send(`Now playing: **${serverQueue.songs[0].title}**`);
	} else if (msg.content.startsWith(`${PREFIX}queue`)) {
		if (!serverQueue) return msg.channel.send('There is nothing playing.');
		return msg.channel.send(`
__**Song queue:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now playing:** ${serverQueue.songs[0].title}
		`);
	} else if (msg.content.startsWith(`${PREFIX}pause`)) {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('Paused the music for you!');
		}
		return msg.channel.send('There is nothing playing.');
	} else if (msg.content.startsWith(`${PREFIX}resume`)) {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('Resumed the music for you!');
		}
		return msg.channel.send('There is nothing playing.');
	}

	return undefined;
});

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', () => {
			console.log('song ended!');
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(TOKEN);